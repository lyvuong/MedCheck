# MedCheck

An installable PWA that lets doctors and staff look up whether a medication
is covered under a patient's insurance plan — formulary tier, prior
authorization / step therapy requirements, an estimated patient cost, and
covered alternatives when a drug isn't covered or sits on a high tier.

There is no server. The React app talks directly to Cloud Firestore via the
Firebase client SDK; Firestore security rules are the only access control
layer, and sign-in is Google only. It's designed to run entirely on free
tiers: Firestore (Spark plan) and Cloudflare Pages.

## Why "pluggable" data sources

There is no self-serve "give me an API key" service for real-time,
patient-specific drug coverage checks — Surescripts RTPB, DrFirst,
CoverMyMeds, Arrive Health, and MedImpact all require enterprise contracts
and EHR-level business agreements. MedCheck is built around that reality:

1. **Manual entry** (works immediately) — an admin/staff screen to enter
   plans, medications, and formulary rules by hand.
2. **CMS public formulary data** (free, real, no contract) — CMS legally
   requires Medicare Advantage, Part D, and ACA Marketplace plans to
   publish machine-readable formulary files. `npm run import:cms` (in
   `scripts/`) bulk-loads them into Firestore. See
   [Importing real CMS data](#importing-real-cms-data).

Both write into the same `formularyEntries` collection, so the
coverage-check UI doesn't care which source answered.

## What it deliberately does NOT store

No patient names, dates of birth, or any patient identifiers — lookups are
just "this drug" + "this plan," logged only as an audit trail of who
looked up what, when. That keeps the data footprint small on purpose; it
does not by itself make you compliant with any regulation, so treat this
as a starting point and apply your own practice's policies accordingly.

## Auth & access model

- Sign-in is **Google only** (Firebase Auth) — no passwords anywhere.
- Two hardcoded email addresses (in [firestore.rules](firestore.rules) and
  [frontend/src/AuthContext.tsx](frontend/src/AuthContext.tsx)) always have
  full admin access, with no Firestore document needed — this sidesteps the
  "who creates the first admin" bootstrap problem.
- Everyone else needs a `users/{email}` Firestore document —
  `{ role: "ADMIN"|"STAFF"|"DOCTOR", name, active: true }` — before they
  have any access at all, even after signing in with Google. Create these
  from the app's **Admin > Users** panel (once you're signed in as the
  owner) or by hand in the Firebase console. A person just signing in
  without a role doc sees a "you don't have access yet" screen.

## Quick start

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com):
   - Enable **Firestore** (Native mode) — stay on the free Spark plan.
   - Enable **Authentication > Sign-in method > Google**.
   - Register a Web App (Project settings > General > Your apps) to get
     the client config, or run:
     ```bash
     firebase apps:create web "MedCheck Web" --project <your-project-id>
     firebase apps:sdkconfig web <appId> --project <your-project-id>
     ```
2. **Deploy security rules and indexes** from the repo root:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes --project <your-project-id>
   ```
3. **Configure the frontend**:
   ```bash
   cd frontend
   cp .env.example .env   # fill in the VITE_FIREBASE_* values from step 1
   npm install
   npm run dev             # http://localhost:5173
   ```
4. **Update the owner allow-list** in both [firestore.rules](firestore.rules)
   and [frontend/src/AuthContext.tsx](frontend/src/AuthContext.tsx) with
   your own Google account email(s), then redeploy rules (step 2).
5. Sign in with Google. Your admin email gets full access immediately —
   no role document needed. Use **Admin > Users** to grant access to
   Staff/Doctors (they must sign in with the exact Google account whose
   email you enter).

## Deploying (Cloudflare)

Connect the GitHub repo via **Workers & Pages > Create > Connect to Git** in
the Cloudflare dashboard. Depending on which flow the dashboard puts you in:

- **Root directory**: `frontend`
- **Build command**: `npm run build`
- **Environment variables**: the six `VITE_FIREBASE_*` values from
  `frontend/.env.example`

If you don't see a "Build output directory" field, your project landed in
Cloudflare's newer **Workers with static assets** model — the output
directory is instead read from [frontend/wrangler.jsonc](frontend/wrangler.jsonc)
(`assets.directory`, already set to `./dist/`), not a dashboard field. Set
`wrangler.jsonc`'s `"name"` to match whatever project name you gave it in
the dashboard. If you do see a "Build output directory" field (classic
Pages), set it to `dist`.

Once deployed, add the deployed URL (and any custom domain) to **Firebase
console > Authentication > Settings > Authorized domains** — Google
Sign-In fails with `auth/unauthorized-domain` until you do this.

## Installing as a PWA

Cloudflare Pages serves over HTTPS by default, so once deployed, open it
in Chrome/Edge/Safari on desktop or mobile and use "Install app" / "Add to
Home Screen." It launches full-screen with an app icon; the app shell
(not live coverage data — that's always fetched fresh) is available
offline.

## Seeding sample data / importing CMS data

`scripts/` holds local-only admin tooling — run by hand with a Firebase
service-account key, never deployed anywhere:

```bash
cd scripts
cp .env.example .env   # FIRESTORE_PROJECT_ID + path to a service-account key
npm install
npm run seed            # sample plans/medications/formulary rules
```

### Importing real CMS data

1. Download the current "Prescription Drug Plan Formulary, Pharmacy
   Network, and Pricing Information" files from
   [CMS](https://www.cms.gov/research-statistics-data-and-systems/files-for-order/nonidentifiabledatafiles/prescriptiondrugplanformularypharmacynetworkandpricinginformationfiles)
   (free, but you review/accept CMS's terms of use yourself).
2. Open `scripts/src/providers/cms/columnMapping.ts` and check the column
   names against your downloaded file's header row — CMS has changed
   these slightly between releases.
3. Run the importer:
   ```bash
   npm run import:cms -- \
     --plans /path/to/plan_information.csv \
     --formulary /path/to/basic_drugs_formulary.csv \
     --year 2026
   ```
   This respects Firestore's free-tier write quota (20,000 writes/day) —
   large imports stop cleanly partway through and can be safely re-run
   the next day to continue.

CMS files identify drugs by NDC/RXCUI, not name, so imported medications
initially display as "NDC 00000000000" — cross-reference against an
RxNorm/NDC directory to backfill readable names if you want nicer display
text than the raw codes.

This only covers Medicare Advantage / Part D and ACA Marketplace plans —
not employer/commercial group insurance, which isn't required to publish
formulary data the same way. Use manual entry for those.

## Project layout

```
frontend/          React + Vite PWA — the entire application
  src/firebase.ts        Firebase app/auth/Firestore client init
  src/AuthContext.tsx     Google Sign-In + role resolution
  src/data/               Firestore client-SDK data access (mirrors scripts/src/db)
  src/pages/              Login, Lookup (main feature), Admin
firestore.rules     The only access-control layer — no server exists
firestore.indexes.json   Composite indexes for the alternatives/admin-list queries
scripts/            Local-only admin tooling (seed data, CMS bulk import)
  src/db/                 Firestore Admin SDK repositories, shared shape with frontend/src/data
  src/providers/cms/      CMS PUF CSV importer
```
