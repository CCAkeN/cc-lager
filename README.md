# CC Lager – Multiuser webbapp (Supabase + QR)

Nu med: bak-kamera som standard (med byt-knapp), valfri skannordning, leverera ut maskin, samt filtrering.

## Snabbstart
1) `npm install`  2) `npm run dev` → http://localhost:5173  
Fyll i SUPABASE_URL + SUPABASE_ANON_KEY i appens setup-vy eller via env:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Deploy (Vercel)
- Build: `npm run build`  → `dist/`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Supabase Auth → URL Configuration → Site URL = din domän (exakt), ev. Additional Redirects för localhost.

## Inloggning
- Magic link + 6-siffrig kod (OTP) – koden kan klistras in direkt i appen.
- E-post + lösenord – aktivera i Supabase (Auth → Providers → Email).

## Flöden
- Flytta maskin: skanna PLATS och MASKIN i valfri ordning. Senaste placement vinner.
- Leverera ut: uppdaterar `machines.status = 'delivered'` och loggar `placements` med `location_id = null`.
- Filtrering: i “Aktuell plats per maskin” – sök på maskin-ID eller plats.
