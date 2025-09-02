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

## Felsökning Magic Link (Supabase)
Om du får ett fel när du klickar på e-postlänken:

1. **Authentication → URL Configuration**
   - **Site URL** = exakt din app-domän (t.ex. `https://dinapp.vercel.app`)
   - **Additional Redirect URLs**: lägg även till `http://localhost:5173` om du kör lokalt.

2. **Providers → Email**
   - Email måste vara **Enabled**.

3. **Öppna i vanlig webbläsare**
   - Vissa e-postappar öppnar i en inbäddad webview. Dela länken till Safari/Chrome om det strular.

4. **Tidsgräns**
   - Länkar kan bli ogiltiga efter en stund. Begär en ny om den blivit gammal.

5. **Domänmatchning**
   - Länken måste peka mot **precis** samma domän som du angivit i Site URL/Redirects (protokoll, subdomän, https).

I denna app använder vi **Supabase Site URL** som redirect. Du behöver alltså inte konfigurera redirect i koden; sätt den rätt i Supabase så fungerar länken.


## Alternativ inloggning: E-post + lösenord
Aktivera i Supabase: **Auth → Providers → Email** (samma sida) och bocka i **Email + Password**.
- I appens login kan du då välja **Logga in med lösenord** eller **Skapa konto**.
- För team: skapa användare direkt i Supabase (Users → Add user) och kryssa **Email confirmed** om ni vill hoppa över bekräftelselänk.

## Vanligt problem: E-postsäkerhet skannar länkar
Vissa e-posttjänster (Outlook, vissa MDM-lösningar) **förhandsöppnar** länkar, vilket gör att OTP-länken förbrukas innan du hinner klicka. Lösningar:
- Använd **6-siffrig kod** i appen (”Verifiera kod”).
- Kopiera länken och öppna i **Safari/Chrome** direkt (inte i inbäddad mail-webview).
- Använd **lösenord**-inloggning istället.
