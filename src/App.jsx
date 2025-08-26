import React, { useMemo, useState } from "react";

// Jednoduchá kalkulačka tržby → výplata
// Zadej: tržbu, odpracované hodiny, hodinovku a bonus %.
// Pravidlo bonusu: rawBonus = trzba * (bonusPct/100).
//  - Když rawBonus > 0 → odečti 20 Kč za každou odpracovanou hodinu.
//  - Když rawBonus ≤ 0 → bonus se nepočítá (0).
// Výsledek: základní mzda + upravený bonus. Vše v CZK.

export default function App() {
  const [trzba, setTrzba] = useState(0)
  const [hodiny, setHodiny] = useState(0)
  const [hodinovka, setHodinovka] = useState(150)
  const [bonusPct, setBonusPct] = useState(10)

  const parseNumber = (v) => {
    if (typeof v === 'string') v = v.replace(',', '.')
    const n = Number(v)
    return isFinite(n) ? n : 0
  }

  const result = useMemo(() => {
    const h = Math.max(0, parseNumber(hodiny) || 0)
    const revenue = Math.max(0, parseNumber(trzba) || 0)
    const pct = parseNumber(bonusPct) || 0

    let mzdaZaklad = (parseNumber(hodinovka) || 0) * h
    const rawBonus = revenue * (pct / 100)

    // Pravidlo: když neodpracuješ žádné hodiny, výplata = 0 (žádný bonus)
    if (h === 0) {
      return {
        mzdaZaklad: 0,
        rawBonus,
        upravaMinusZaHodiny: 0,
        bonusFinal: 0,
        vyplataCelkem: 0,
        efektivniNaHod: 0,
      }
    }

    let upravaMinusZaHodiny = 0
    let bonusFinal = 0
    if (rawBonus > 0) {
      upravaMinusZaHodiny = 20 * h
      bonusFinal = Math.max(0, rawBonus - upravaMinusZaHodiny)
    } else {
      bonusFinal = 0
    }

    const vyplataCelkem = mzdaZaklad + bonusFinal
    const efektivniNaHod = h > 0 ? vyplataCelkem / h : 0

    return {
      mzdaZaklad,
      rawBonus,
      upravaMinusZaHodiny,
      bonusFinal,
      vyplataCelkem,
      efektivniNaHod,
    }
  }, [trzba, hodiny, hodinovka, bonusPct])

  function formatCZK(v) {
    if (!isFinite(v)) return '–'
    return v.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 })
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kalkulačka tržeb → výplata</h1>
            <p className="text-sm text-gray-600">Zadej hodnoty níže; výsledek se přepočítává automaticky.</p>
          </div>
          <a className="text-xs text-gray-500 underline" href="https://vitejs.dev" target="_blank" rel="noreferrer">Vite + React</a>
        </header>

        {/* Vstupy */}
        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="text-lg font-semibold">Vstupy</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm">Tržba (CZK)
              <input type="number" inputMode="numeric" step={1} min={0}
                value={trzba}
                onChange={(e)=>setTrzba(parseNumber(e.target.value))}
                className="block mt-1 border rounded-lg px-3 py-2 w-full text-right" placeholder="0" />
            </label>
            <label className="text-sm">Odpracované hodiny
              <input type="number" inputMode="decimal" step="any" min={0}
                value={hodiny}
                onChange={(e)=>setHodiny(parseNumber(e.target.value))}
                className="block mt-1 border rounded-lg px-3 py-2 w-full text-right" placeholder="0" />
            </label>
            <label className="text-sm">Hodinová mzda (CZK)
              <input type="number" inputMode="numeric" step={1} min={0}
                value={hodinovka}
                onChange={(e)=>setHodinovka(parseNumber(e.target.value))}
                className="block mt-1 border rounded-lg px-3 py-2 w-full text-right" placeholder="150" />
            </label>
            <label className="text-sm">Bonus (%)
              <input type="number" inputMode="decimal" step="any"
                value={bonusPct}
                onChange={(e)=>setBonusPct(e.target.value)}
                className="block mt-1 border rounded-lg px-3 py-2 w-full text-right" placeholder="0.3" />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={()=>{setTrzba(0); setHodiny(0); setHodinovka(150); setBonusPct(10);}} className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50">Reset</button>
          </div>
        </section>

        {/* Výsledky */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card title="Základní mzda" value={formatCZK(result.mzdaZaklad)} sub="hodinovka × hodiny" />
          <Card title="Bonus (před úpravou)" value={formatCZK(result.rawBonus)} sub="tržba × %" />
          <Card title="Úprava −20 Kč/h" value={`− ${formatCZK(result.upravaMinusZaHodiny)}`} sub={result.rawBonus > 0 && result.mzdaZaklad > 0 ? "odečítá se jen když je bonus kladný" : "neodečítá se"} />
          <Card title="Bonus po úpravě" value={formatCZK(result.bonusFinal)} />
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Highlight title="Výplata celkem" value={formatCZK(result.vyplataCelkem)} />
          <Highlight title="Efektivně na hodinu" value={formatCZK(result.efektivniNaHod)} />
        </section>

        <footer className="text-xs text-gray-500 text-center py-6">© {new Date().getFullYear()} Kalkulačka tržeb • Vše v CZK • Žádná data se neukládají</footer>
      </div>
    </div>
  )
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function Highlight({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
