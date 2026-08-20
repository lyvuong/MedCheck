# 🏥 MedCheck

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

An installable, zero-backend Progressive Web App (PWA) that empowers doctors, medical staff, and care coordinators to instantly check medication coverage under patient insurance plans. MedCheck surfaces formulary tiers, prior authorization (PA) flags, step therapy requirements, estimated patient out-of-pocket costs, and intelligent covered alternatives.

Designed to operate **100% on free tiers** (Firebase Spark Plan + Cloudflare Pages) with direct client-to-Firestore communication secured by granular Firestore Security Rules.

---

## 📑 Table of Contents

- [Why Clinicians Need MedCheck](#-why-clinicians-need-medcheck-the-shifting-formulary-reality)
- [Healthcare & Insurance Terminology Guide](#-healthcare--insurance-terminology-guide)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Why "Pluggable" Data Sources?](#-why-pluggable-data-sources)
- [Privacy & Compliance by Design](#-privacy--compliance-by-design)
- [How to Use MedCheck](#-how-to-use-medcheck)
  - [1. Clinician & Staff Workflow (Coverage Lookup)](#1-clinician--staff-workflow-coverage-lookup)
  - [2. Finding Covered Alternatives](#2-finding-covered-alternatives)
  - [3. Administrator Workflow (User & Formulary Management)](#3-administrator-workflow-user--formulary-management)
  - [4. Installing MedCheck as a PWA](#4-installing-medcheck-as-a-pwa)
- [Authentication & Role-Based Access Control (RBAC)](#-authentication--role-based-access-control-rbac)
- [Developer Quick Start](#-developer-quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Firebase Setup](#1-firebase-setup)
  - [2. Security Rules & Indexes Deployment](#2-security-rules--indexes-deployment)
  - [3. Frontend Setup & Local Dev](#3-frontend-setup--local-dev)
  - [4. Configure Admin Allow-List](#4-configure-admin-allow-list)
- [Data Ingestion & CLI Scripts](#-data-ingestion--cli-scripts)
  - [Seeding Mock/Sample Data](#seeding-mocksample-data)
  - [Importing Real CMS Public Formulary Data](#importing-real-cms-public-formulary-data)
- [Deployment Guide (Cloudflare)](#-deployment-guide-cloudflare)
- [Project Directory Structure](#-project-directory-structure)
- [Contributors & Credits](#-contributors--credits)
- [License](#-license)

---

## 🩺 Why Clinicians Need MedCheck: The Shifting Formulary Reality

In modern clinical practice, prescribing the right medication is only half the battle — ensuring the patient can actually obtain and afford it is often the harder challenge.

### 1. 🔄 Constantly Shifting Insurance Policies & Formulary Churn
Commercial health insurers and Pharmacy Benefit Managers (PBMs) alter their drug coverage rules, tiers, and exclusion lists **multiple times per year** (often quarterly or mid-cycle).
- A maintenance drug covered with a modest $15 copay in January can abruptly be reclassified to a Tier 4/5 specialty tier or dropped altogether in June.
- Insurers frequently substitute preferred brands (e.g., switching preferred GLP-1 agonists, inhalers, or statins) based on renegotiated rebate contracts, leaving prescribers in the dark until claims fail at the pharmacy.

### 2. 📉 Preventing "Copay Shock" and Prescription Abandonment
High out-of-pocket costs are the **#1 cause of prescription abandonment**.
- Studies show that when a patient's out-of-pocket medication cost exceeds $50, abandonment rates jump to over **30%** (and over **50%** when costs exceed $100).
- When a patient discovers an unaffordable copay at the pharmacy counter, they frequently leave empty-handed without notifying their physician, leading to unmanaged chronic diseases, complications, and hospital readmissions.
- MedCheck gives physicians visibility into estimated tier costs **during the consultation**, enabling shared decision-making before the patient leaves the clinic.

### 3. 🛑 Eliminating the "Pharmacy Callback & Fax" Spiral
Without point-of-care coverage visibility, clinics suffer from relentless administrative friction:
```text
Doctor Prescribes Drug ➔ Patient Goes to Pharmacy ➔ Claim Rejected (Non-Covered or PA Required)
       ▲                                                                   │
       └──────── Pharmacy Faxes / Calls Clinic ◄── Nurse Retriages ────────┘
```
This loop drains hours of staff, nurse, and physician time every week on retroactive prior authorizations, chart reviews, and re-prescribing. MedCheck prevents this bottleneck at the source.

### 4. ⚡ Navigating Prior Authorization (PA) & Step Therapy ("Fail First")
Insurers increasingly deploy **Utilization Management Controls** to contain costs:
- **Prior Authorization (PA)**: Demands extensive diagnostic paperwork before covering a drug.
- **Step Therapy (ST)**: Requires patients to try and "fail" one or more older, cheaper medications before approving the prescribed treatment.
- **Quantity Limits (QL)**: Caps pill counts or days-of-supply per refill.
MedCheck flags these restrictions upfront, allowing doctors to select an already-approved therapeutic alternative or initiate documentation immediately.

### 5. 💡 Free, Lightweight Independence from Monopolized EHR Modules
Commercial Real-Time Prescription Benefit (RTPB) add-ons in enterprise EHRs are often expensive, locked behind multi-year contracts, or cumbersome to use. MedCheck is a fast, free, standalone PWA that any clinician or medical assistant can pull up on a phone, tablet, or secondary screen in seconds.

---

## 📚 Healthcare & Insurance Terminology Guide

For developers and contributors new to healthcare technology, here is a quick plain-English glossary of terms used throughout this project:

| Term | What It Means | Why It Matters in MedCheck |
| :--- | :--- | :--- |
| **Formulary** | The official master list of prescription drugs covered by an insurance plan. | The core dataset queried during every coverage lookup. |
| **Formulary Tiers** | Pricing categories that dictate patient out-of-pocket cost: <br>• **Tier 1 (Preferred Generic)**: Lowest copay (e.g., $5–$10). <br>• **Tier 2 (Generic)**: Low copay (e.g., $10–$20). <br>• **Tier 3 (Preferred Brand)**: Moderate copay (e.g., $40–$60). <br>• **Tier 4 (Non-Preferred Drug)**: High cost brand/generic. <br>• **Tier 5 (Specialty)**: High-cost biologics/complex drugs. | Displayed as clear visual badges so clinicians can gauge patient affordability immediately. |
| **Copay vs. Coinsurance** | • **Copay**: A fixed flat fee per refill (e.g., $15). <br>• **Coinsurance**: A percentage of the drug's retail price (e.g., 20% of a $1,200 drug = $240). | Surfaced in the estimated cost field so patients aren't caught off-guard by percentage-based bills. |
| **Prior Authorization (`PA`)** | A requirement where the insurer must review medical records and approve clinical necessity *before* paying for the drug. | Flagged as a warning badge so staff can initiate paperwork proactively instead of reacting to rejections. |
| **Step Therapy (`ST`)** | A "fail first" rule requiring the patient to try cheaper/older medications first before the insurer covers the prescribed drug. | Notified upfront to help doctors decide whether to prescribe step-1 drugs or submit an override request. |
| **Quantity Limit (`QL`)** | Restrictions on the maximum dose, pill count, or days of supply per fill (e.g., "30 tablets per 30 days"). | Informs dosing decisions and refill intervals. |
| **PBM (Pharmacy Benefit Manager)** | Third-party administrators (e.g., CVS Caremark, Express Scripts, OptumRx) that manage drug plans for insurers. | Responsible for frequent tier changes and rebate-driven drug exclusions. |
| **NDC (National Drug Code)** | A unique 10- or 11-digit universal product identifier for medications in the United States (like a barcode). | Used as unique identifiers in the database and during CMS CSV bulk imports. |
| **CMS PUF** | **Centers for Medicare & Medicaid Services Public Use Files** — open government datasets detailing Medicare Part D & ACA coverage. | Powers MedCheck's automated bulk data ingestion pipeline (`scripts/src/providers/cms/`). |
| **RTPB** | **Real-Time Prescription Benefit** — electronic protocols that check patient coverage live during the prescribing workflow. | MedCheck provides a zero-cost, open, serverless alternative to commercial RTPB networks. |

---

## ✨ Key Features

- **⚡ Instant Real-Time Lookup**: Debounced, typeahead search across medications (by brand name, generic name, or NDC) and insurance plans (by payer name or plan name).
- **📋 Granular Formulary Insights**: Displays Tier 1–5 classification, coverage status, Prior Authorization (`PA`) flags, Step Therapy (`ST`) requirements, Quantity Limits (`QL`), and estimated copay/coinsurance.
- **🔄 Intelligent Covered Alternatives**: Automatically suggests therapeutic alternatives in the same drug class when a medication is non-covered or placed on a high/expensive tier.
- **🔒 Zero-Backend Serverless Architecture**: Client communicates directly with Cloud Firestore via the Firebase Web SDK v11, eliminating backend maintenance overhead and server attack surfaces.
- **📱 Installable Progressive Web App (PWA)**: Works seamlessly on desktop (Chrome, Edge, Safari) and mobile (iOS & Android) with offline app-shell caching and home screen installation.
- **👥 Role-Based Access Control (RBAC)**: Supports Google Sign-In with fine-grained access tiers (`ADMIN`, `STAFF`, `DOCTOR`) enforced at the database level via Firestore Security Rules.
- **📥 Dual Data Ingestion Modes**: Supports instant manual entry via the Admin UI as well as bulk ingestion of official CMS Medicare Advantage & Part D Public Use Files (PUF).
- **🌓 Dark / Light Theme**: Built-in system-aware theme toggle with custom CSS tokens for comfortable clinical use in any lighting condition.

---

## 🏛 System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               MedCheck Frontend (PWA)                  │
│       React 18 + TypeScript + Vite + Vanilla CSS       │
└───────────▲────────────────────────────────▲───────────┘
            │                                │
     [Firebase Auth]                 [Firebase Client SDK]
      (Google OAuth)                  (Direct Firestore)
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│     Firebase Auth     │        │ Firestore Security    │
│  (Google Sign-In only)│        │ Rules (RBAC & Auth)   │
└───────────────────────┘        └───────────┬───────────┘
                                             │
                                             ▼
                                 ┌───────────────────────┐
                                 │    Cloud Firestore    │
                                 │  - insurancePlans     │
                                 │  - medications        │
                                 │  - formularyEntries   │
                                 │  - users              │
                                 │  - lookupLogs         │
                                 └───────────▲───────────┘
                                             │
                                  [Firebase Admin SDK]
                                             │
                                 ┌───────────────────────┐
                                 │ Local Admin Scripts   │
                                 │  - Seed sample data   │
                                 │  - CMS PUF importer   │
                                 └───────────────────────┘
```

---

## 💡 Why "Pluggable" Data Sources?

There is no self-serve, open "give me an API key" service for real-time patient drug coverage checks. Commercial RTPB (Real-Time Prescription Benefit) platforms (e.g., Surescripts, DrFirst, CoverMyMeds, Arrive Health, MedImpact) require enterprise contracts, high minimums, and EHR-level certification.

MedCheck solves this with two complementary data sources writing to a unified `formularyEntries` schema:

1. **Manual Entry** *(Immediate & Flexible)*: Clinic staff can enter their practice's most common commercial and local insurance plan formularies directly through the web UI.
2. **CMS Public Formulary Data** *(Free, Real & Comprehensive)*: CMS legally requires Medicare Advantage, Part D, and ACA Marketplace plans to publish machine-readable formulary files. MedCheck includes an automated batch importer (`scripts/src/providers/cms/`) that maps and loads CMS Public Use Files (PUF) into Firestore.

---

## 🛡 Privacy & Compliance by Design

MedCheck is built with a **Zero-PHI (Protected Health Information)** philosophy:
- **No patient identifiers stored**: No patient names, dates of birth, social security numbers, medical record numbers, or addresses are ever collected or stored.
- **Purely Plan + Drug Lookups**: Queries log only *which drug* was checked against *which insurance plan* alongside a timestamp and the authenticated staff email for auditability.
- *Note*: While this architecture minimizes data risk, each healthcare organization should apply its own clinical governance and compliance policies.

---

## 📖 How to Use MedCheck

### 1. Clinician & Staff Workflow (Coverage Lookup)

1. **Sign In**: Navigate to the MedCheck application URL and click **Sign in with Google**.
2. **Search Medication**: In the **Medication** field, begin typing the brand name, generic name, or NDC (National Drug Code). Select the desired drug from the autocomplete dropdown.
3. **Search Insurance Plan**: In the **Insurance Plan** field, type the payer name (e.g., *Blue Cross*, *Aetna*, *UnitedHealthcare*, *Medicare*) or plan name. Select the patient's plan.
4. **View Coverage Results**: MedCheck instantly queries Firestore and displays:
   - **Coverage Status**: Green badge (`Covered`) or red badge (`Not covered`).
   - **Formulary Tier**: e.g., *Tier 1 — Preferred generic*, *Tier 2 — Generic*, *Tier 3 — Preferred brand*, *Tier 4 — Non-preferred*, *Tier 5 — Specialty*.
   - **Utilization Controls**: Badges indicating if **Prior Authorization (PA)**, **Step Therapy (ST)**, or **Quantity Limits (QL)** apply.
   - **Estimated Cost**: Estimated patient copay amount or coinsurance percentage.
   - **Clinical / Formulary Notes**: Any specific dispenser or prescribing guidelines attached to the entry.
   - **Data Origin**: Source indicator showing whether the data is from manual entry or CMS public formulary data.

### 2. Finding Covered Alternatives

When a drug is **Not Covered** or sits on a high tier (e.g., Tier 3+ or specialty):
1. Look below the primary coverage box at the **"Covered alternatives in this class"** section.
2. MedCheck automatically queries all other medications in the same therapeutic `drugClass` on that insurance plan.
3. Review available lower-tier alternatives along with their tier badge and estimated copay to help discuss cost-effective options with the patient.

### 3. Administrator Workflow (User & Formulary Management)

Users with the `ADMIN` role have access to the **Admin** navigation tab:

#### Managing Users
1. Go to **Admin > Users**.
2. In the **Grant access** form:
   - Enter the team member's Google email address.
   - Enter their display name.
   - Select their role:
     - **`DOCTOR`**: Can perform lookups and view covered alternatives.
     - **`STAFF`**: Can perform lookups and manually create/edit plans, drugs, and formulary entries.
     - **`ADMIN`**: Full permissions including user provisioning and activation toggles.
3. Click **Grant access**. The user can now sign in immediately using that Google account.
4. Existing users can be deactivated or reactivated instantly using the **Deactivate / Reactivate** toggle.

#### Manual Formulary Data Entry
1. Go to **Admin > Formulary entry**.
2. **Add a Health Plan**: Enter the Payer Name, Plan Name, Plan Type (HMO, PPO, Part D), and State.
3. **Add a Medication**: Enter the brand/display name, generic name, NDC, therapeutic drug class, strength, and dosage form.
4. **Create / Update Formulary Rules**: Link any plan to any medication, selecting coverage status, tier, prior auth / step therapy flags, quantity limits, and copay/coinsurance amounts.

### 4. Installing MedCheck as a PWA

MedCheck includes a full Web App Manifest and Service Worker:
- **Desktop (Chrome / Edge / Brave)**: Click the **Install** icon on the right side of the browser address bar, or go to *Menu > Install MedCheck*.
- **iOS (Safari)**: Tap the **Share** button at the bottom of the screen, scroll down, and tap **"Add to Home Screen"**.
- **Android (Chrome)**: Tap the three-dot menu and select **"Install app"** or **"Add to Home screen"**.

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

MedCheck enforces a strict authorization hierarchy:

| Role | Coverage Lookup | View Alternatives | Manual Data Entry | User Management |
| :--- | :---: | :---: | :---: | :---: |
| **DOCTOR** | ✅ | ✅ | ❌ | ❌ |
| **STAFF** | ✅ | ✅ | ✅ | ❌ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ |

- **Google OAuth Only**: No passwords to manage or leak.
- **Bootstrap Admin**: Hardcoded owner emails in [`firestore.rules`](firestore.rules) and [`frontend/src/AuthContext.tsx`](frontend/src/AuthContext.tsx) bypass the "first user" chicken-and-egg problem.
- **Self-Lockout Prevention**: Any Google account without an active document in `users/{email}` is automatically presented with an unauthorized access notice.

---

## 🚀 Developer Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/) (v10+)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

### 1. Firebase Setup
1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** in **Native mode** (choose the free Spark plan).
3. Navigate to **Authentication > Sign-in method** and enable **Google**.
4. Register a Web App under **Project Settings > General > Your apps** to obtain your Firebase client configuration.

### 2. Security Rules & Indexes Deployment
Log in to Firebase and deploy the security rules and composite indexes from the root directory:

```bash
# Login to Firebase CLI
firebase login

# Deploy rules and indexes to your Firebase project
firebase deploy --only firestore:rules,firestore:indexes --project <YOUR_PROJECT_ID>
```

### 3. Frontend Setup & Local Dev

```bash
# Navigate to the frontend directory
cd frontend

# Copy the sample environment file
cp .env.example .env

# Edit .env and paste your Firebase Web App credentials:
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Configure Admin Allow-List

Update the bootstrap owner email address in:
1. [`firestore.rules`](firestore.rules) (in the `isOwner()` function)
2. [`frontend/src/AuthContext.tsx`](frontend/src/AuthContext.tsx) (in `HARDCODED_ADMINS`)

Then redeploy the rules:
```bash
firebase deploy --only firestore:rules --project <YOUR_PROJECT_ID>
```

---

## 📊 Data Ingestion & CLI Scripts

The `scripts/` directory provides CLI tools powered by the Firebase Admin SDK.

### Seeding Mock/Sample Data
To populate your Firestore database with realistic sample plans (e.g., Blue Cross, Aetna, Humana), medications (Lipitor, Metformin, Eliquis, Ozempic), and formulary tier rules:

1. Generate a Firebase Service Account key:
   - Go to **Firebase Console > Project Settings > Service accounts**.
   - Click **Generate new private key** and save the JSON file locally.
2. Configure environment variables in `scripts/`:
   ```bash
   cd scripts
   cp .env.example .env
   ```
   Set:
   ```env
   FIRESTORE_PROJECT_ID=your-project-id
   FIREBASE_SERVICE_ACCOUNT_KEY=../firebase-service-account.json
   ```
3. Install dependencies and run the seed script:
   ```bash
   npm install
   npm run seed
   ```

### Importing Real CMS Public Formulary Data

1. Download the latest public formulary dataset from [CMS Non-Identifiable Data Files](https://www.cms.gov/research-statistics-data-and-systems/files-for-order/nonidentifiabledatafiles/prescriptiondrugplanformularypharmacynetworkandpricinginformationfiles).
2. Verify column names against [`scripts/src/providers/cms/columnMapping.ts`](scripts/src/providers/cms/columnMapping.ts).
3. Execute the bulk importer:
   ```bash
   npm run import:cms -- \
     --plans /path/to/plan_information.csv \
     --formulary /path/to/basic_drugs_formulary.csv \
     --year 2026
   ```

> **Note on Free Quotas**: The importer automatically tracks write counts to operate safely within Firestore's free tier (20,000 writes/day). Large imports can pause cleanly and resume on subsequent days.

---

## ☁ Deployment Guide (Cloudflare)

Deploy the frontend directly to Cloudflare Pages or Cloudflare Workers Static Assets:

1. Push your repository to GitHub / GitLab.
2. In the Cloudflare Dashboard, navigate to **Compute (Workers) > Workers & Pages > Create > Pages > Connect to Git**.
3. Select your MedCheck repository and configure the build settings:
   - **Framework preset**: `Vite` (or `None`)
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Add the six `VITE_FIREBASE_*` environment variables in the Cloudflare dashboard.
5. Click **Save and Deploy**.
6. **Important**: Add your custom Cloudflare domain (e.g., `https://medcheck.pages.dev`) to **Firebase Console > Authentication > Settings > Authorized domains** to allow Google Sign-In.

---

## 📁 Project Directory Structure

```text
MedCheck/
├── .firebaserc                    # Firebase project configuration
├── firebase.json                  # Firebase deployment schema (Firestore rules/indexes)
├── firestore.rules                # Database security rules (RBAC enforcement)
├── firestore.indexes.json         # Composite indexes for alternative queries
├── README.md                      # Project documentation
│
├── frontend/                      # React + TypeScript + Vite PWA
│   ├── index.html                 # HTML shell and PWA meta headers
│   ├── package.json               # Frontend dependencies & scripts
│   ├── tsconfig.json              # TypeScript configuration
│   ├── vite.config.ts             # Vite build & PWA plugin config
│   ├── src/
│   │   ├── main.tsx               # Application entry point
│   │   ├── App.tsx                # Route definitions & layout wrapping
│   │   ├── Layout.tsx             # Shared navigation bar & header
│   │   ├── ThemeToggle.tsx        # Light/Dark mode switcher
│   │   ├── AuthContext.tsx        # Firebase Auth state & role resolution
│   │   ├── firebase.ts            # Firebase client SDK initialization
│   │   ├── styles.css             # Design tokens & responsive styles
│   │   ├── pages/
│   │   │   ├── Login.tsx          # Google Sign-In & unauthorized screen
│   │   │   ├── Lookup.tsx         # Real-time drug & plan coverage lookup
│   │   │   └── Admin.tsx          # User management & manual formulary entry
│   │   └── data/                  # Firestore Client SDK data access layer
│   │       ├── types.ts           # Core TypeScript data schemas
│   │       ├── coverage.ts        # Coverage evaluation & alternative search
│   │       ├── insurancePlans.ts  # Plan search and manual creation
│   │       ├── medications.ts     # Medication search and manual creation
│   │       ├── formularyEntries.ts# Formulary upsert & retrieval
│   │       └── users.ts           # User role querying and provisioning
│
└── scripts/                       # Local Admin CLI Tooling (Firebase Admin SDK)
    ├── package.json               # Scripts dependencies (tsx, firebase-admin)
    └── src/
        ├── db/                    # Admin SDK repositories
        │   ├── seed.ts            # Sample data seeder
        │   ├── medications.ts     # Drug admin data layer
        │   ├── insurancePlans.ts  # Plan admin data layer
        │   └── formularyEntries.ts# Formulary admin data layer
        └── providers/cms/         # CMS PUF Data Importer
            ├── importCli.ts       # CLI entrypoint for CSV ingestion
            └── columnMapping.ts   # CSV header definitions & type parsers
```

---

## 👥 Contributors & Credits

- **[Ly Vuong](https://github.com/lyvuong)** — Creator & Lead Maintainer
- **Antigravity** (Google DeepMind) — AI Pair Programmer & Technical Co-developer

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
