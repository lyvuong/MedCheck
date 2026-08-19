# MedCheck

A self-hosted, installable PWA that lets doctors and staff look up whether a
medication is covered under a patient's insurance plan — formulary tier,
prior authorization / step therapy requirements, an estimated patient cost,
and covered alternatives when a drug isn't covered or sits on a high tier.

Built to run on your own infrastructure (Proxmox/Unraid, or any Docker
host) with Postgres for storage, per-user accounts with roles, and a
pluggable data layer so you're not locked into one source of formulary
data.

## Why "pluggable" data sources

There is no self-serve "give me an API key" service for real-time,
patient-specific drug coverage checks — Surescripts RTPB, DrFirst,
CoverMyMeds, Arrive Health, and MedImpact all require enterprise contracts
and EHR-level business agreements. MedCheck is built around that reality
instead of around it:

1. **Manual entry** (works immediately) — an admin/staff screen to enter
   plans, medications, and formulary rules by hand. The app ships seeded
   with a small realistic sample dataset so it's usable the moment you
   deploy it.
2. **CMS public formulary data** (free, real, no contract) — CMS legally
   requires Medicare Advantage, Part D, and ACA Marketplace plans to
   publish machine-readable formulary files. `npm run import:cms` bulk-
   loads them. See [Importing real CMS data](#importing-real-cms-data).
3. **Weno Exchange** (optional, paid) — the one real-time formulary/benefit
   API with genuinely self-serve sandbox access (~$1,600 setup + per-
   transaction fees), rather than a sales cycle. Stubbed and ready to wire
   up in `backend/src/providers/weno/wenoProvider.ts` once you have
   credentials; disabled by default.

All three write into the same `formulary_entries` table, so the
coverage-check UI and API don't care which source answered — you can mix
manually-entered plans with CMS-imported ones with Weno as a live fallback.

## What it deliberately does NOT store

No patient names, dates of birth, or any patient identifiers — lookups are
just "this drug" + "this plan," logged only as an audit trail of who
looked up what, when. That keeps the data footprint small on purpose; it
does not by itself make you compliant with any regulation, so treat this
as a starting point and apply your own practice's policies (access
control, backups, network exposure) accordingly.

## Quick start (Docker Compose)

```bash
cp .env.example .env
# edit .env: set JWT_SECRET (openssl rand -base64 48), POSTGRES_PASSWORD,
# and BOOTSTRAP_ADMIN_EMAIL/PASSWORD

docker compose up -d --build
```

The web UI is published on `http://<your-server>:8080` (change `WEB_PORT`
in `.env`). On first boot the backend creates one admin account from
`BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` — log in with that, then
create real accounts for your doctors/staff from the Admin screen.

To load the same sample data used in development (a handful of plans,
common medications across drug classes, and varied coverage rules so you
can see tiers/PA/step-therapy/alternatives in action):

```bash
docker compose exec backend npm run seed
```

### Deploying on Unraid

Point Unraid's Docker Compose manager (or the Compose Manager plugin) at
this repo's `docker-compose.yml`, or run `docker compose up -d --build`
from a terminal in the appdata share. Postgres data persists in the
`db-data` named volume — map it to a path under `/mnt/user/appdata/` if
you want it alongside your other containers' data for easier backup.

### Deploying on Proxmox

Run it in an LXC container or VM with Docker installed, same
`docker compose up -d --build` flow. If you're already running a Docker
host VM for other self-hosted services, this fits alongside them — it's
three containers (Postgres, API, web) behind whatever reverse proxy
(Traefik, nginx, Caddy) you already use for TLS/subdomain routing.

## Installing as a PWA

Once the app is running behind HTTPS (required for service workers on
anything but `localhost`), open it in Chrome/Edge/Safari on desktop or
mobile and use "Install app" / "Add to Home Screen." It'll launch
full-screen with an app icon, and the shell (not live coverage data —
that's always fetched fresh) is available offline.

If you don't have TLS yet, put it behind a reverse proxy that terminates
HTTPS (Caddy is the least fuss — one line per domain) — the PWA install
prompt won't appear over plain HTTP except on `localhost`.

## Local development

```bash
# 1. Postgres (or use docker compose up db)
# 2. Backend
cd backend
cp .env.example .env   # DATABASE_URL etc.
npm install
npm run db:migrate
npm run seed
npm run dev             # http://localhost:4000

# 3. Frontend, in another terminal
cd frontend
npm install
npm run dev              # http://localhost:5173, proxies /api to :4000
```

Sample logins after `npm run seed` (change these before real use):

| Role   | Email               | Password       |
|--------|---------------------|----------------|
| Admin  | admin@example.com   | ChangeMe123!   |
| Doctor | doctor@example.com  | ChangeMe123!   |
| Staff  | staff@example.com   | ChangeMe123!   |

## Importing real CMS data

1. Download the current "Prescription Drug Plan Formulary, Pharmacy
   Network, and Pricing Information" files from
   [CMS](https://www.cms.gov/research-statistics-data-and-systems/files-for-order/nonidentifiabledatafiles/prescriptiondrugplanformularypharmacynetworkandpricinginformationfiles)
   (free, but you review/accept CMS's terms of use yourself — there's no
   API/click-through for this).
2. Open `backend/src/providers/cms/columnMapping.ts` and check the column
   names against your downloaded file's header row — CMS has changed
   these slightly between releases, so this is the one place to adjust
   them if they don't match.
3. Run the importer:

   ```bash
   docker compose exec backend npm run import:cms -- \
     --plans /path/to/plan_information.csv \
     --formulary /path/to/basic_drugs_formulary.csv \
     --year 2026
   ```

   (Mount the CSVs into the backend container first, or run this from a
   local `npm run dev` checkout pointed at the same `DATABASE_URL`.)

CMS files identify drugs by NDC/RXCUI, not name, so imported medications
initially display as "NDC 00000000000" — cross-reference against an
RxNorm/NDC directory to backfill readable names if you want nicer display
text than the raw codes.

This only covers Medicare Advantage / Part D and ACA Marketplace plans —
not employer/commercial group insurance, which isn't required to publish
formulary data the same way. For those, use manual entry or Weno.

## Enabling Weno Exchange (optional)

1. Sign up for sandbox/production access at
   [wenoexchange.com](https://wenoexchange.com) — this is a real business
   relationship you set up yourself; nothing here can do it for you.
2. Fill in `WENO_API_BASE_URL` and `WENO_API_KEY` in `.env` and restart
   the backend.
3. Open `backend/src/providers/weno/wenoProvider.ts` and adjust the
   request/response field mapping to match Weno's actual current API
   contract (the shape in this repo is a placeholder — check their docs).

Once configured, the coverage-check endpoint automatically falls back to
a live Weno lookup whenever no local formulary entry exists yet for a
plan/medication pair, and caches the result for future lookups.

## Project layout

```
backend/    Fastify + TypeScript API, Drizzle ORM, Postgres
  src/db/          schema, migrations runner, seed script
  src/providers/   pluggable formulary data sources (manual/CMS/Weno)
  src/routes/      auth, medication/plan search, coverage check, admin CRUD
frontend/   React + Vite PWA
  src/pages/       Login, Lookup (main feature), Admin
docker-compose.yml  Postgres + backend + nginx-served frontend
```
