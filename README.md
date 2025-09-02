# CC Lager – Multiuser webbapp (Supabase + QR)

Enkel lagerapp för maskiner med ID (CCxxxx) och lagerplatser. Skanna plats → skanna maskin → systemet loggar flytten och visar aktuell plats per maskin. Generera och skriv ut QR-etiketter direkt i appen.

## Snabbstart

1. Supabase – kör SQL från tidigare instruktion (tabeller + policies), aktivera Email (Magic Link) och lägg till din webbadress under Auth URL Configuration.
2. Miljövariabler i host:
   - `VITE_SUPABASE_URL` = din Project URL
   - `VITE_SUPABASE_ANON_KEY` = din anon key
   (eller fyll i dessa i appens setup-vy första gången)
3. Lokalt:
   ```bash
   npm install
   npm run dev
   # http://localhost:5173
   ```
4. Deploy (Vercel/Netlify):
   - Build: `npm run build`
   - Publish dir: `dist/`
   - Env vars: se punkt 2.

## Användning
- Generera QR: Klistra in lista (A1–A40 eller CC0001–CC0200), skriv ut och spara i DB.
- Flytta maskin: Skanna PLATS → skanna MASKIN → Registrera.
- Aktuell plats: Senaste placement vinner. Historik visar alla flyttar.
