# RoboCam event schedule profiles

`remote-config.json` is the small router read by Arnošt RoboCam Bridge v10.3.3+.

To switch conferences without releasing a new Chrome extension version:

1. Add or update an event profile in this folder.
2. Point `../remote-config.json` to it with `activeEvent` and `eventConfigUrl`.
3. Increment only the router/profile `configVersion` / `version` string. The extension version stays unchanged.

## Event profile

Required operational fields are `id`, `name`, `shortName`, `timezone`, `utcOffset`, `dates`, `locations`, and `schedule`.

For normal public agenda pages:

```json
{
  "schedule": {
    "sourceType": "html",
    "urls": ["https://event.example/agenda"],
    "refreshMinutes": 5,
    "minSessions": 20
  }
}
```

For a site that the generic HTML parser cannot read, put normalized data on Git and use:

```json
{
  "schedule": {
    "sourceType": "json",
    "dataUrl": "https://raw.githubusercontent.com/OWNER/REPO/main/path/schedule.json",
    "refreshMinutes": 5
  }
}
```

Normalized schedule JSON:

```json
{
  "sessions": [
    {
      "date": "2026-09-29",
      "start": "09:00",
      "end": "09:30",
      "title": "Session title",
      "location": "Main Stage"
    }
  ]
}
```

Room mappings and schedule caches are namespaced by event id, so switching events does not reuse another conference's mapping.
