import React, { useMemo, useState } from 'react'

const INITIAL_FORM = {
  trzba: '0',
  hodiny: '0',
  hodinovka: '220',
  bonusPct: '10',
}

const currencyFormatter = new Intl.NumberFormat('cs-CZ', {
  style: 'currency',
  currency: 'CZK',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('cs-CZ', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function parseLocalizedNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value !== 'string') {
    return 0
  }

  const normalized = value.trim().replace(/\s+/g, '').replace(',', '.')
  if (!normalized) {
    return 0
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCZK(value) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  return currencyFormatter.format(value)
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  return numberFormatter.format(value)
}

function getInsight(result) {
  if (result.hours === 0) {
    return 'Bez odpracovaných hodin zůstává výplata i bonus na nule.'
  }

  if (result.rawBonus <= 0) {
    return 'Bonus vyšel nulový, takže se neodečítá hodinová úprava.'
  }

  if (result.bonusFinal === 0) {
    return 'Celý bonus pokryla úprava 20 Kč za každou odpracovanou hodinu.'
  }

  return `Po odečtení ${formatCZK(result.upravaMinusZaHodiny)} zůstává z bonusu ${formatCZK(result.bonusFinal)}.`
}

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM)

  const result = useMemo(() => {
    const revenue = Math.max(0, parseLocalizedNumber(form.trzba))
    const hours = Math.max(0, parseLocalizedNumber(form.hodiny))
    const hourlyRate = Math.max(0, parseLocalizedNumber(form.hodinovka))
    const bonusPct = parseLocalizedNumber(form.bonusPct)

    const rawBonus = revenue * (bonusPct / 100)

    if (hours === 0) {
      return {
        revenue,
        hours,
        hourlyRate,
        bonusPct,
        mzdaZaklad: 0,
        rawBonus,
        upravaMinusZaHodiny: 0,
        bonusFinal: 0,
        vyplataCelkem: 0,
        efektivniNaHod: 0,
      }
    }

    const mzdaZaklad = hourlyRate * hours
    const upravaMinusZaHodiny = rawBonus > 0 ? 20 * hours : 0
    const bonusFinal = rawBonus > 0 ? Math.max(0, rawBonus - upravaMinusZaHodiny) : 0
    const vyplataCelkem = mzdaZaklad + bonusFinal
    const efektivniNaHod = vyplataCelkem / hours

    return {
      revenue,
      hours,
      hourlyRate,
      bonusPct,
      mzdaZaklad,
      rawBonus,
      upravaMinusZaHodiny,
      bonusFinal,
      vyplataCelkem,
      efektivniNaHod,
    }
  }, [form])

  const insight = getInsight(result)

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value
    setForm((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  const metrics = [
    {
      title: 'Základní mzda',
      value: formatCZK(result.mzdaZaklad),
      detail: 'hodinovka × odpracované hodiny',
      tone: 'metric-card-warm',
    },
    {
      title: 'Bonus před úpravou',
      value: formatCZK(result.rawBonus),
      detail: 'tržba × zadané procento',
      tone: 'metric-card-sky',
    },
    {
      title: 'Odečet 20 Kč / h',
      value: result.upravaMinusZaHodiny > 0 ? `−${formatCZK(result.upravaMinusZaHodiny)}` : formatCZK(0),
      detail: result.rawBonus > 0 ? 'odečítá se jen při kladném bonusu' : 'při nulovém bonusu se neodečítá',
      tone: 'metric-card-rose',
    },
    {
      title: 'Bonus po úpravě',
      value: formatCZK(result.bonusFinal),
      detail: 'částka, která se přičte k výplatě',
      tone: 'metric-card-emerald',
    },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="orb orb-amber float-slow" />
        <div className="orb orb-sand float-reverse" />
        <div className="orb orb-ink pulse-soft" />
        <div className="mesh-overlay" />
      </div>

      <main className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel lift-in overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
          <h1 className="headline-font text-4xl leading-tight text-slate-900 sm:text-5xl">
            Kalkulačka tržeb
          </h1>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <section className="glass-panel lift-in px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Vstupy</h2>
                  <p className="mt-2 text-sm text-slate-600">Pole nechávají zapsat i mezikrok typu `12,` a přepočet běží průběžně.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(INITIAL_FORM)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white"
                >
                  Reset formuláře
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  label="Tržba"
                  unit="CZK"
                  value={form.trzba}
                  onChange={handleChange('trzba')}
                  placeholder="0"
                  inputMode="decimal"
                  hint="Celková tržba, ze které se počítá bonus."
                />
                <Field
                  label="Odpracované hodiny"
                  unit="h"
                  value={form.hodiny}
                  onChange={handleChange('hodiny')}
                  placeholder="0"
                  inputMode="decimal"
                  hint="Hodiny můžeš psát třeba jako 7,5."
                />
                <Field
                  label="Hodinová mzda"
                  unit="CZK"
                  value={form.hodinovka}
                  onChange={handleChange('hodinovka')}
                  placeholder="220"
                  inputMode="decimal"
                  hint="Základ bez bonusové složky."
                />
                <Field
                  label="Bonus z tržby"
                  unit="%"
                  value={form.bonusPct}
                  onChange={handleChange('bonusPct')}
                  placeholder="10"
                  inputMode="decimal"
                  hint="Podporuje zápis 10,5 i 10.5."
                />
              </div>
            </section>

            <section className="glass-panel lift-in px-6 py-7 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="soft-pill">Jak se počítá</span>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-300/70 to-transparent" />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <RuleCard
                  step="1"
                  title="Bonus před úpravou"
                  text="Vezme se tržba a vynásobí se procentem, které zadáš."
                />
                <RuleCard
                  step="2"
                  title="Odečet za hodiny"
                  text="Když je bonus kladný, odečte se 20 Kč za každou odpracovanou hodinu."
                />
                <RuleCard
                  step="3"
                  title="Nulové hodiny"
                  text="Pokud jsou hodiny 0, nevyplácí se základ ani bonus."
                />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="result-panel lift-in px-6 py-7 sm:px-8">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-lg">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                      Výplata celkem
                    </div>
                    <div className="mt-4 text-4xl font-semibold tabular-nums text-white sm:text-5xl">
                      {formatCZK(result.vyplataCelkem)}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-white/78">{insight}</p>
                  </div>

                  <div className="result-badge">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/60">Efektivně</div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
                      {formatCZK(result.efektivniNaHod)}
                    </div>
                    <div className="mt-2 text-xs text-white/60">za hodinu</div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniResult label="Tržba" value={formatCZK(result.revenue)} />
                  <MiniResult label="Odpracováno" value={`${formatNumber(result.hours)} h`} />
                  <MiniResult label="Hodinovka" value={formatCZK(result.hourlyRate)} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  detail={metric.detail}
                  tone={metric.tone}
                />
              ))}
            </section>
          </div>
        </section>

        <footer className="px-2 pb-4 pt-2 text-center text-xs text-slate-500">
          Kalkulačka běží lokálně v prohlížeči, nic nikam neodesílá.
        </footer>
      </main>
    </div>
  )
}

function Field({ hint, inputMode, label, onChange, placeholder, unit, value }) {
  return (
    <label className="field-card">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="mt-2 text-xs leading-5 text-slate-500">{hint}</span>
      <div className="input-shell">
        <input
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full border-0 bg-transparent p-0 text-right text-xl font-semibold tabular-nums text-slate-900 outline-none placeholder:text-slate-300"
        />
        <span className="pl-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          {unit}
        </span>
      </div>
    </label>
  )
}

function RuleCard({ step, text, title }) {
  return (
    <div className="rounded-[24px] border border-white/70 bg-white/70 p-5 shadow-[0_18px_40px_rgba(148,101,62,0.08)] backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
        {step}
      </div>
      <div className="mt-4 text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}

function MetricCard({ detail, title, tone, value }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="mt-3 text-sm leading-6 text-slate-600">{detail}</div>
    </div>
  )
}

function MiniResult({ label, value }) {
  return (
    <div className="rounded-[20px] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">{label}</div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  )
}
