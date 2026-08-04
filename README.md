# Ayurvedic Pathya-Apathya Advisor — Runnable MVP

This is a working slice of the full architecture we designed: a Node.js/Express/MongoDB
backend serving a Pathya-Apathya knowledge base, and a plain HTML/CSS/JS frontend
(installable as a mobile app via PWA) that renders **Doctor** and **Patient** views
from the same data.

No paid services required. Everything below runs on free tiers.

```
pathya-apathya-advisor/
├── backend/          Express API + MongoDB models + seed data
├── frontend/          Static PWA (works standalone AND embeds into an existing site)
├── render.yaml         Optional Render deployment blueprint
└── README.md           This file
```

---

## 1. What's included in this MVP (vs. the full architecture)

To get you something you can actually run today, this build simplifies a few things
from the full architecture document. It is a real foundation, not a toy — but be aware:

- **Embedded documents instead of fully normalized collections.** Each disease document
  contains its own Pathya/Apathya items, Dinacharya, Ritucharya, citations, etc. The full
  architecture normalizes these into separate collections for large-scale content reuse
  (see `Pathya-Apathya-Advisor-Architecture.md` from our earlier design step). Migrate to
  that model once you have multiple contributors editing shared content.
- **Simple API-key admin auth**, not full role-based doctor/reviewer/admin accounts.
  Good enough while you're the only content editor; upgrade later.
- **3 fully-seeded sample diseases** (Pandu, Amavata, Jwara) to demonstrate the full data
  model end-to-end. Add more via the admin API (see Section 6).
- **No AI features yet** — those come later, per the roadmap in the architecture doc.

---

## 2. Prerequisites

- Node.js 18+ installed
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) account (free M0 cluster)
- A free [Render](https://render.com) account (for hosting, when you're ready)
- (Optional) [Git](https://git-scm.com/) if you want to push this to GitHub for Render to deploy from

---

## 3. Run it locally first

### 3.1 Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — get this from MongoDB Atlas: create a free cluster → Database Access
  (create a user) → Network Access (allow 0.0.0.0/0 for now) → Connect → "Drivers" → copy
  the connection string, replace `<username>`/`<password>`.
- `ADMIN_API_KEY` — make up any long random string, e.g. `openssl rand -hex 24`.
- `ALLOWED_ORIGINS` — for local testing, leave the default (`http://localhost:3000,http://127.0.0.1:5500`).

Seed sample data:
```bash
npm run seed
```

Start the server:
```bash
npm run dev
```
You should see `Pathya-Apathya Advisor API running on port 5000`.

Test it: open `http://localhost:5000/api/diseases/search?q=pandu` in your browser —
you should get JSON back.

### 3.2 Frontend

The frontend is plain static files — no build step, no npm install needed for it.

Easiest local way: use VS Code's "Live Server" extension on `frontend/index.html`,
or run:
```bash
cd frontend
npx serve .
```
Then open the printed local URL. Since `js/config.js` auto-detects `localhost`, it
will talk to your local backend automatically.

Try searching "Pandu" — you should see the Doctor card. Toggle to "Patient" to see
the simplified version of the *same* data.

---

## 4. Deploy for free (no paid tier needed)

### 4.1 Backend → Render

1. Push this whole folder to a GitHub repo (private is fine).
2. In Render: **New → Web Service** → connect your repo.
3. Root Directory: `backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Instance Type: **Free**
7. Add Environment Variables (Render dashboard → Environment):
   - `MONGODB_URI` = your Atlas connection string
   - `ADMIN_API_KEY` = your chosen secret
   - `ALLOWED_ORIGINS` = the URL(s) your frontend will be served from (add your real
     domain once you know it; you can update this anytime without redeploying code)
8. Deploy. Render gives you a URL like `https://pathya-apathya-advisor-api.onrender.com`.

> **Free-tier note:** Render's free web services "sleep" after ~15 minutes of no traffic
> and take a few seconds to wake up on the next request. Fine for an MVP/OPD tool with
> intermittent use; upgrade to a paid instance later if you need always-on speed.

### 4.2 Frontend → Render Static Site (also free) or your existing website

**Option A — separate platform (its own site):**
1. In Render: **New → Static Site** → same repo.
2. Root Directory: `frontend`
3. Build Command: leave blank (no build step)
4. Publish Directory: `.`
5. Before deploying, edit `frontend/js/config.js` and replace
   `YOUR-RENDER-BACKEND-URL` with your actual backend URL from step 4.1.
6. Deploy. You'll get a URL like `https://pathya-apathya-advisor.onrender.com`.

**Option B — embed into your existing Ayurveda website (recommended if you already have one):**
See Section 5 below.

---

## 5. Integrating into your existing Ayurveda website

You have two clean options depending on your current site's tech stack.

### Option 1: Subfolder/subdomain embed (works with any website, even non-Next.js)
1. Copy the entire `frontend/` folder into your existing site as `/pathya-advisor/`
   (e.g., `yoursite.com/pathya-advisor/index.html`).
2. Update `frontend/js/config.js` to point at your deployed backend URL.
3. Add a link/button from your existing site's navigation to `/pathya-advisor/`.
4. Deploy your site as normal — the module now lives inside your existing domain,
   and cookies/branding can be shared if you style `style.css` to match your site.

### Option 2: If your existing site is Next.js
1. Keep this `backend/` as a **separate microservice** on Render (don't merge it into
   your Next.js app — keeps deploys independent and avoids serverless cold-start issues
   with MongoDB connections).
2. In your Next.js app, add a new route, e.g. `app/pathya-advisor/page.tsx`, and either:
   - **(a) Simple:** iframe the deployed static frontend:
     `<iframe src="https://your-pathya-frontend.onrender.com" style={{width:'100%',height:'100vh',border:'none'}} />`
   - **(b) Native:** rebuild the two components (`DoctorCard`, `PatientCard`) as React
     components inside your Next.js app, calling the same backend API endpoints
     (`/api/diseases/search`, `/api/diseases/:slug`) directly with `fetch`. This gives
     you full design consistency with your existing site. The rendering logic in
     `frontend/js/render.js` is a direct blueprint for what each React component needs
     to display — I can convert these into actual React components on request.
3. Either way, just add your Next.js site's real domain to `ALLOWED_ORIGINS` on the
   backend's Render environment variables.

---

## 6. Adding more diseases (content workflow)

All content edits go through the admin API, protected by your `ADMIN_API_KEY`.

**Add a new disease** — `POST {backend-url}/api/admin/diseases` with header
`x-api-key: <your key>` and a JSON body shaped like the entries in
`backend/seed/seedData.js` (use that file as your template — copy an entry, edit it).

**Publish a draft** — `POST {backend-url}/api/admin/diseases/<slug>/publish`

**Update existing** — `PUT {backend-url}/api/admin/diseases/<slug>`

You can do this with any REST client (Postman, Insomnia, or `curl`). A proper
admin UI (content entry form) is the natural next build — see Section 8.

---

## 7. Mobile app — you don't need a separate build right now

The frontend is a **Progressive Web App (PWA)**:
- `manifest.json` + `service-worker.js` make it installable on a phone home screen
  (Chrome/Android: "Add to Home Screen"; iOS Safari: Share → "Add to Home Screen").
- Once installed, it opens full-screen like a native app, works with a custom icon,
  and caches the app shell for offline use (see `service-worker.js` — it caches the
  UI itself; disease data the user has already viewed is cached via `localStorage`
  in `app.js` so it's viewable offline too).
- This avoids building/maintaining a separate React Native app while still giving
  patients and doctors an "app-like" experience on mobile, at zero extra cost.

If you later want a true native app (App Store/Play Store presence), the same backend
API can be reused as-is — only a new frontend client would need to be built.

---

## 8. Sensible next build steps, in order

1. Get this running locally, confirm Pandu/Amavata/Jwara render correctly in both modes.
2. Deploy backend to Render + frontend embedded into your existing site.
3. Add your own 10–20 most common OPD diagnoses via the admin API.
4. Build a simple admin **form UI** (instead of raw API calls) so content entry doesn't
   require Postman — I can build this next if useful.
5. Add doctor login + "Send to Patient via WhatsApp/SMS" once you're ready to move past
   manual link-sharing.
6. Migrate to the fully normalized schema (separate `citations`, `pathya_apathya_items`
   collections) once multiple people are contributing content, per the architecture doc.

---

## 9. Admin panel (per-user login, roles, audit log, Excel bulk import)

A browser-based admin panel lives at `frontend/admin.html`, linked from the "⚙ Admin"
button in the main app's header.

### 9.1 Accounts & roles

Content editors sign in with their own email + password (not a shared secret). Two roles:

- **editor** — create and edit diseases, but only as drafts. Can't publish, delete,
  run bulk Excel import/export, or see the audit log.
- **admin** — everything editors can do, plus publish, delete, bulk import/export,
  user management, and the audit log.

**New env vars needed:**

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs login sessions. Set this to any long random string. |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | Auto-creates the very first admin account on server startup, only if no accounts exist yet. Safe to leave set permanently — it's a no-op after the first run. |
| `ADMIN_API_KEY` | Still used, but now only as the **master key** for account management (see below) — not for day-to-day logins. |

**Managing accounts:** open `admin.html`, expand "⚙ Manage accounts" on the login
screen, enter the `ADMIN_API_KEY` master key, and create/deactivate/promote accounts
from there — no separate admin tool needed.

**Brute-force protection:** 5 failed logins locks an account for 15 minutes
(an admin can manually unlock it early from the accounts panel). The login endpoint is
also rate-limited by IP address.

### 9.2 Audit log

Every create, edit, publish, delete, and bulk import is recorded with who did it and
when, visible to admins in the "🕵 Audit log" section of the panel.

### 9.3 Manual entry & Excel bulk import

**Manual entry:** "+ New disease" opens a form covering every field in the `Disease`
schema — nidana, pathya/apathya ahara & vihara, dinacharya, ritucharya, precautions,
patient education, and citations — each as an "add row" repeater.

**Bulk Excel import/export (admin only):**
- **Download blank template** — a `.xlsx` with the correct column headers, one filled
  example row, and a "Read Me" sheet explaining the format.
- **Export current data** — every disease currently in the database, in the same format.
- **Upload & overwrite** — pick a filled-in `.xlsx` and upload it. Each row is matched to
  an existing disease by its `slug` column: if that slug already exists, the disease is
  **completely overwritten**; if it's new, a disease is created. One bad row won't block
  the rest of the sheet — you get a per-row error summary after upload.

Because the schema has nested lists, the spreadsheet uses two plain-text separators
instead of extra columns: `|` between multiple entries in one cell, and `::` between
sub-fields inside one entry. The template's "Read Me" sheet spells this out with
examples for every column.

**New backend dependencies:** `multer` + `xlsx` (spreadsheet handling), `bcryptjs` +
`jsonwebtoken` (per-user auth) — all already in `backend/package.json`, so a normal
`npm install` in `backend/` picks them up.

### 9.4 QR codes for printed patient handouts

Each disease row in the admin panel has a "QR" button. Clicking it shows a QR code
encoding a direct link back into the app — e.g. `index.html?slug=pandu` — that opens
straight to that disease's **patient-mode** page (skipping search entirely). Useful
for printing a permanent QR code per disease into a physical reference book: a patient
scans it with their phone camera and lands directly on the simple, patient-friendly
version of that condition.

- **Copy link** copies the URL if you'd rather generate/design the QR yourself.
- **Download PNG** saves a 600×600 QR image (via the free api.qrserver.com service —
  no new backend dependency) named `<slug>-qr.png`, ready to drop into a print layout.

This works regardless of where the frontend is hosted (root domain or a subfolder) —
the link is built relative to wherever `admin.html` is running.

---

## 11. Dravya Module (new, separate from everything above)

A second, self-contained module lives at `frontend/dravya.html`, reached via a
"🌿 Dravya Module" link in the Admin panel header. **It is completely independent
of the Disease/Pathya-Apathya module described above** — its own collections
(`Dravya`, `DravyaTag`), its own routes (`/api/dravya/*`), its own frontend
page and JS file. Nothing in Sections 1–10 was changed to build this.

- **No public access.** Every route requires the same doctor/editor login used
  by `admin.html` (same JWT session — if you're logged into one, you're logged
  into both). There is no patient-facing page for this module.
- **Dravya entries.** Each Dravya (food/substance) is tagged with Rasa, Guna,
  Dosha effect, and Indications (diseases/conditions) — all four are
  independent, growing checkbox lists. Type a brand-new option inline while
  entering a Dravya and it's saved permanently as a checkbox for every future
  entry, for every editor.
- **Browse by indication.** Pick an indication checkbox to see every Dravya
  checked for it, plus a quality profile (Rasa/Guna/Dosha tally) derived from
  those entries.
- **Habit analyzer** (one-off, nothing saved). Select the Dravyas a patient
  habitually eats, with an optional frequency per item (Occasional ×1,
  Weekly ×2, Daily ×3 — blank counts as ×1). It tallies the qualities involved
  — it does not guess a diagnosis. Separately, pick a diagnosis from the same
  indication list to see what qualities are commonly indicated for it.
- **Bulk Excel import/export (admin only).** Same pattern as the Disease
  module's importer: download a blank `.xlsx` template (with a filled example
  row and a "Read Me" sheet), fill in one row per Dravya, upload to create or
  **completely overwrite** — matched by the `name` column, case-insensitive.
  One bad row won't block the rest; you get a per-row error summary. Every
  checkbox value used in the sheet (`rasa`/`guna`/`dosha`/`indications`,
  pipe-`|`-separated for multiple values) goes through the same
  case-insensitive de-dupe as the single-entry form — re-uploading the same
  sheet, or a sheet with different capitalization of an existing value, never
  creates a duplicate checkbox. You can also **export current data** back out
  to the same format, e.g. to bulk-edit and re-upload.

New backend files: `backend/models/Dravya.js`, `backend/models/DravyaTag.js`,
`backend/routes/dravya.js`, `backend/utils/dravyaExcelSheet.js`. No new npm
dependencies — reuses the same Express/Mongoose/JWT/multer/xlsx stack already
in `package.json`.

---

## 12. Troubleshooting

- **CORS errors in browser console** → add your frontend's exact URL to `ALLOWED_ORIGINS`
  on the backend and redeploy/restart.
- **"MongoDB connection failed"** → check your Atlas Network Access allows your IP
  (or 0.0.0.0/0 while testing), and that the password in `MONGODB_URI` doesn't contain
  unescaped special characters.
- **Render free backend feels slow on first request** → that's the free-tier "sleep"
  behavior described in Section 4.1, not a bug.
