# Kalkulačka tržeb → výplata (Vite + React + Tailwind)

Jednoduchá webová apka: zadáš **tržbu**, **odpracované hodiny**, **hodinovou mzdu** a **bonus %** a dostaneš **výplatu celkem** podle pravidla:

- `rawBonus = tržba × (bonus% / 100)`
- Pokud `rawBonus > 0`, **odečítá se 20 Kč za každou odpracovanou hodinu** (bonus = rawBonus − 20×hodiny, minimálně 0).
- Pokud `rawBonus ≤ 0`, **bonus = 0**.
- Výplata = základní mzda (hodinovka × hodiny) + bonus po úpravě.

## Lokální spuštění

1. Nainstaluj Node.js (doporučeno v18+ nebo v20+).
2. V kořeni projektu spusť:
   ```bash
   npm install
   npm run dev
   ```
3. Otevři URL z terminálu (typicky http://localhost:5173).

## Build

```bash
npm run build
npm run preview   # volitelné – lokální náhled buildu
```

Výstup je ve složce `dist/`.

## Nasazení – Vercel (doporučeno)

### Varianta A: GitHub → Vercel
1. Nahraj tento projekt do **GitHub** repozitáře.
2. Na **vercel.com** klikni **New Project** → **Import Git Repository**.
3. Framework zvol *Vite*, Build Command: `npm run build`, Output: `dist/`.
4. Deploy – Vercel vygeneruje veřejnou URL (`https://...vercel.app`).

### Varianta B: Bez GitHubu – Vercel CLI
1. `npm i -g vercel`
2. `vercel` (poprvé – průvodce) → `vercel --prod` (ostrý deploy).

## Alternativy nasazení

### Netlify (drag & drop)
1. `npm run build` → složka `dist/`.
2. Na **app.netlify.com** → **Add new site** → **Deploy manually** → přetáhni obsah `dist/`.

### GitHub Pages
1. Použij akci `peaceiris/actions-gh-pages` nebo ručně publikuj `dist/` na branch `gh-pages`.
2. V repu **Settings → Pages** nastav `gh-pages` jako zdroj.

---

Autor: Arnoštův asistent 😉
