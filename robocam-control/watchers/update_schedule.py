#!/usr/bin/env python3
"""
Normalize public conference agenda pages into stable JSON consumed by
Arnost RoboCam Bridge.

The event profile stays on GitHub. A watcher-enabled profile declares its
upstream page(s), parser preset and output path. This script never overwrites
last-known-good data when parsing looks suspicious.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from bs4.element import Tag

TIME_PAIR_12 = re.compile(
    r"(?:^|\D)(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)\s*(?:-|–|—|to)?\s*"
    r"(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)(?!\w)",
    re.I,
)
TIME_PAIR_24 = re.compile(
    r"(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)\s*(?:-|–|—|to)\s*"
    r"([01]?\d|2[0-3]):([0-5]\d)(?!\d)",
    re.I,
)

MONTHS = {
    "jan": "01", "january": "01", "feb": "02", "february": "02",
    "mar": "03", "march": "03", "apr": "04", "april": "04", "may": "05",
    "jun": "06", "june": "06", "jul": "07", "july": "07", "aug": "08",
    "august": "08", "sep": "09", "sept": "09", "september": "09",
    "oct": "10", "october": "10", "nov": "11", "november": "11",
    "dec": "12", "december": "12",
}


def norm(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def to24(hour: str, minute: str, ampm: str = "") -> str:
    h, m = int(hour), int(minute)
    if not 0 <= m <= 59:
        return ""
    marker = ampm.upper()
    if marker:
        if not 1 <= h <= 12:
            return ""
        if marker == "AM":
            h = 0 if h == 12 else h
        else:
            h = 12 if h == 12 else h + 12
    elif not 0 <= h <= 23:
        return ""
    return f"{h:02d}:{m:02d}"


def time_pair(text: str) -> tuple[str, str] | None:
    text = norm(text)
    m = TIME_PAIR_12.search(text)
    if m:
        return to24(m.group(1), m.group(2), m.group(3)), to24(m.group(4), m.group(5), m.group(6))
    m = TIME_PAIR_24.search(text)
    if m:
        return to24(m.group(1), m.group(2)), to24(m.group(3), m.group(4))
    return None


def count_time_pairs(text: str) -> int:
    text = norm(text)
    return len(TIME_PAIR_12.findall(text)) + len(TIME_PAIR_24.findall(text))


def date_from_text(value: str, dates: list[str]) -> str:
    text = norm(value)
    if not text:
        return ""

    for iso in dates:
        if iso in text:
            return iso

    m = re.search(r"\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b", text)
    if m:
        iso = f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        if iso in dates:
            return iso

    m = re.search(
        r"\b(0?[1-9]|[12]\d|3[01])\s+"
        r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+"
        r"(20\d{2})\b",
        text,
        re.I,
    )
    if m:
        key = m.group(2).lower()
        month = MONTHS.get(key) or MONTHS.get(key[:3])
        iso = f"{m.group(3)}-{month}-{int(m.group(1)):02d}" if month else ""
        if iso in dates:
            return iso

    m = re.search(
        r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+"
        r"(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?,?\s+(20\d{2})\b",
        text,
        re.I,
    )
    if m:
        key = m.group(1).lower()
        month = MONTHS.get(key) or MONTHS.get(key[:3])
        iso = f"{m.group(3)}-{month}-{int(m.group(2)):02d}" if month else ""
        if iso in dates:
            return iso

    day_word = re.search(r"\bday[\s_-]*(one|two|three|four|five|six|seven|1|2|3|4|5|6|7)\b", text, re.I)
    if day_word:
        indexes = {
            "one": 0, "two": 1, "three": 2, "four": 3, "five": 4, "six": 5, "seven": 6,
            "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6,
        }
        idx = indexes[day_word.group(1).lower()]
        if idx < len(dates):
            return dates[idx]

    weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for iso in dates:
        try:
            weekday = datetime.fromisoformat(iso).strftime("%A").lower()
        except ValueError:
            continue
        if weekday in weekdays and re.search(rf"\b{weekday}\b", text, re.I):
            return iso

    return ""


def bad_title(text: str, locations: list[str]) -> bool:
    value = norm(text)
    if len(value) < 4 or len(value) > 360:
        return True
    if re.match(
        r"^(learn more|register(?: now)?|speakers?|session moderator|presented by|headline sponsor|"
        r"sponsored by|view|image:|search|filters?|read more|panell?ists?|moderator|chair|free to attend)"
        r"(?:\\s*\\(.*\\))?$",
        value,
        re.I,
    ):
        return True
    if re.match(r"^\d{1,2}:\d{2}\s*(?:am|pm)?", value, re.I):
        return True
    return False


def exact_location(text: str, locations: list[str]) -> str:
    low = norm(text).lower()
    for location in locations:
        if low == location.lower():
            return location
    return ""


def location_from_text(text: str, locations: list[str]) -> str:
    low = norm(text).lower()
    matches = [loc for loc in locations if loc.lower() in low]
    return max(matches, key=len) if matches else ""


def tag_text(tag: Tag) -> str:
    return norm(tag.get_text(" ", strip=True))


def find_card(anchor: Tag) -> Tag | None:
    current: Tag | None = anchor
    for _ in range(11):
        if not isinstance(current, Tag):
            break
        text = tag_text(current)
        if 12 <= len(text) <= 8000 and count_time_pairs(text) == 1:
            return current
        current = current.parent if isinstance(current.parent, Tag) else None
    return None


def title_from_card(card: Tag, anchor: Tag, locations: list[str]) -> str:
    hinted = tag_text(anchor)
    if not bad_title(hinted, locations):
        return hinted
    for a in card.find_all("a", href=True):
        text = tag_text(a)
        if not bad_title(text, locations):
            return text
    for node in card.find_all(["h1", "h2", "h3", "h4", "h5", "strong"]):
        text = tag_text(node)
        if not bad_title(text, locations):
            return text
    return ""


def explicit_date_for_node(node: Tag, dates: list[str]) -> str:
    current: Tag | None = node
    for _ in range(10):
        if not isinstance(current, Tag):
            break
        attrs = []
        for key in ("data-date", "data-day", "datetime", "id", "class", "aria-label", "title"):
            val = current.attrs.get(key)
            if isinstance(val, list):
                val = " ".join(map(str, val))
            if val:
                attrs.append(str(val))
        found = date_from_text(" ".join(attrs), dates)
        if found:
            return found
        text = tag_text(current)
        if len(text) <= 2200:
            found = date_from_text(text, dates)
            if found:
                return found
        current = current.parent if isinstance(current.parent, Tag) else None
    return ""


def parse_generic_html(html: str, profile: dict[str, Any], source_url: str) -> dict[str, Any]:
    dates = list(profile.get("dates") or [])
    locations = list(profile.get("locations") or [])
    short_name = norm(profile.get("shortName") or profile.get("name") or "EVENT")
    allow_overlaps = bool(profile.get("allowOverlaps"))

    soup = BeautifulSoup(html, "html.parser")
    all_tags = soup.find_all(True)
    order = {id(tag): idx for idx, tag in enumerate(all_tags)}

    headings: list[tuple[int, str]] = []
    for node in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "legend", "div", "p", "span"]):
        loc = exact_location(tag_text(node), locations)
        if not loc:
            continue
        if len(node.find_all(recursive=False)) > 6:
            continue
        headings.append((order.get(id(node), -1), loc))
    headings.sort(key=lambda x: x[0])

    seen_cards: set[int] = set()
    raw: list[dict[str, Any]] = []

    for anchor in soup.find_all("a", href=True):
        anchor_text = tag_text(anchor)
        if bad_title(anchor_text, locations):
            continue
        card = find_card(anchor)
        if card is None or id(card) in seen_cards:
            continue
        text = tag_text(card)
        pair = time_pair(text)
        if not pair or not pair[0] or not pair[1]:
            continue
        title = title_from_card(card, anchor, locations)
        if not title:
            continue

        card_pos = order.get(id(card), 10**12)
        location = ""
        for heading_pos, heading_loc in headings:
            if heading_pos < card_pos:
                location = heading_loc
            else:
                break
        if not location:
            location = location_from_text(text, locations)
        if not location:
            continue

        seen_cards.add(id(card))
        raw.append({
            "date": explicit_date_for_node(card, dates),
            "start": pair[0],
            "end": pair[1],
            "title": title,
            "location": location,
            "stream": location or short_name,
            "_order": len(raw),
        })

    # ITC-style pages repeat the same ordered stage list once per event day.
    # If cards do not carry an explicit date, a stage-rank reset marks a new day.
    day_index = 0
    previous_rank = -1
    for session in raw:
        try:
            explicit_idx = dates.index(session["date"])
        except ValueError:
            explicit_idx = -1
        try:
            rank = locations.index(session["location"])
        except ValueError:
            rank = -1

        if explicit_idx >= 0:
            day_index = explicit_idx
        else:
            if rank >= 0 and previous_rank >= 0 and rank < previous_rank:
                day_index = min(len(dates) - 1, day_index + 1)
            session["date"] = date_from_text(session["title"], dates) or (dates[day_index] if dates else "")
        if rank >= 0:
            previous_rank = rank

    unique: dict[str, dict[str, Any]] = {}
    for s in raw:
        if s["date"] not in dates or s["location"] not in locations:
            continue
        key = "|".join((s["date"], s["start"], s["end"], s["location"], norm(s["title"]))).lower()
        if key not in unique:
            unique[key] = {
                "date": s["date"],
                "start": s["start"],
                "end": s["end"],
                "title": norm(s["title"]),
                "location": s["location"],
                "stream": s["location"] or short_name,
            }

    sessions = list(unique.values())

    # ITC explicitly allows simultaneous sessions within a category. For other
    # event types we still only de-duplicate exact records here; the extension
    # may apply its stricter timeline conflict handling when configured.
    sessions.sort(key=lambda s: (s["date"], s["start"], locations.index(s["location"]) if s["location"] in locations else 999, s["title"]))
    present_locations = [loc for loc in locations if any(s["location"] == loc for s in sessions)]

    return {
        "sessions": sessions,
        "locations": present_locations,
        "sourceUrl": source_url,
        "allowOverlaps": allow_overlaps,
    }


def fetch_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; ArnostRoboCamScheduleWatcher/1.0; +https://github.com/12arnost/trzby-app)",
            "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace")


def canonical_hash(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--events-dir", default="robocam-control/events")
    parser.add_argument("--event", default="", help="Optional event id/path filter")
    args = parser.parse_args()

    root = Path.cwd()
    events_dir = root / args.events_dir
    profiles = sorted(events_dir.glob("*.json"))
    profiles = [p for p in profiles if not p.name.endswith("-schedule.json")]

    changed = 0
    checked = 0

    for profile_path in profiles:
        profile = load_json(profile_path)
        watcher = profile.get("watcher") if isinstance(profile.get("watcher"), dict) else {}
        if watcher.get("enabled") is not True:
            continue
        if args.event and args.event not in {str(profile.get("id") or ""), profile_path.name, str(profile_path)}:
            continue

        checked += 1
        parser_preset = str(watcher.get("parserPreset") or profile.get("parserPreset") or "generic-dom-v1")
        if parser_preset != "generic-dom-v1":
            raise RuntimeError(f"{profile_path}: unsupported watcher parserPreset {parser_preset!r}")

        urls = [str(u) for u in watcher.get("sourceUrls", []) if str(u).startswith("https://")]
        if not urls:
            raise RuntimeError(f"{profile_path}: watcher.sourceUrls is empty")

        output_rel = str(watcher.get("outputPath") or f"robocam-control/events/{profile.get('id','event')}-schedule.json")
        output_path = root / output_rel
        min_sessions = int(watcher.get("minSessions") or profile.get("schedule", {}).get("minSessions") or 1)
        require_all_dates = watcher.get("requireAllDates", True) is True

        parts = []
        source_hash = hashlib.sha256()
        for url in urls:
            html = fetch_text(url)
            source_hash.update(url.encode("utf-8"))
            source_hash.update(b"\0")
            source_hash.update(html.encode("utf-8", errors="replace"))
            parts.append(parse_generic_html(html, profile, url))

        # Merge all configured sources.
        merged: dict[str, dict[str, Any]] = {}
        for part in parts:
            for s in part["sessions"]:
                key = "|".join((s["date"], s["start"], s["end"], s["location"], s["title"])).lower()
                merged.setdefault(key, s)
        locations = list(profile.get("locations") or [])
        sessions = sorted(
            merged.values(),
            key=lambda s: (s["date"], s["start"], locations.index(s["location"]) if s["location"] in locations else 999, s["title"]),
        )
        present_locations = [loc for loc in locations if any(s["location"] == loc for s in sessions)]

        counts = Counter(s["date"] for s in sessions)
        if len(sessions) < min_sessions:
            raise RuntimeError(
                f"{profile_path}: parsed only {len(sessions)} sessions, minimum is {min_sessions}; refusing to overwrite last-known-good schedule"
            )
        if require_all_dates:
            missing = [d for d in profile.get("dates", []) if counts.get(d, 0) == 0]
            if missing:
                raise RuntimeError(
                    f"{profile_path}: no sessions parsed for {', '.join(missing)}; refusing to overwrite last-known-good schedule"
                )

        stable = {
            "schemaVersion": 1,
            "eventId": profile.get("id"),
            "eventVersion": profile.get("version"),
            "sourceUrls": urls,
            "sessionCount": len(sessions),
            "countsByDate": {d: counts.get(d, 0) for d in profile.get("dates", [])},
            "locations": present_locations,
            "sessions": sessions,
        }
        schedule_hash = canonical_hash(stable)

        previous = {}
        if output_path.exists():
            try:
                previous = load_json(output_path)
            except Exception:
                previous = {}

        if previous.get("scheduleHash") == schedule_hash:
            print(
                f"[schedule-watcher] {profile.get('id')}: checked OK, unchanged "
                f"({len(sessions)} sessions; {dict(counts)})"
            )
            continue

        output = {
            **stable,
            "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "sourceHash": source_hash.hexdigest(),
            "scheduleHash": schedule_hash,
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        changed += 1
        print(
            f"[schedule-watcher] {profile.get('id')}: UPDATED "
            f"{len(sessions)} sessions; {dict(counts)} -> {output_rel}"
        )

    if checked == 0:
        print("[schedule-watcher] no watcher-enabled event profile matched")
    print(f"[schedule-watcher] checked={checked} changed={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
