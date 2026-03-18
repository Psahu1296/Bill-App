# Dhaba POS

*For offline frontend development, see [Dummy Data Guide](./dummy-data-guide.md)*

Dhaba POS is a comprehensive point-of-sale system...

A full-featured **Point-of-Sale desktop app** for restaurants and dhabas. Runs entirely offline — no server setup, no cloud subscription, no IT skills needed. Just download and use.

<table>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/ibjxvy5o1ikbsdebrjky.png" alt="Home" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502773/ietao6dnw6yjsh4f71zn.png" alt="Orders" width="300"/></td>
  </tr>
  <tr>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/vesokdfpa1jb7ytm9abi.png" alt="Menu" width="300"/></td>
    <td><img src="https://res.cloudinary.com/amritrajmaurya/image/upload/v1740502772/setoqzhzbwbp9udpri1f.png" alt="Tables" width="300"/></td>
  </tr>
</table>

---

## Download

Head to the [**Releases page**](../../releases/latest) and download the installer for your operating system.

| Platform | File | Notes |
|----------|------|-------|
| Windows | `Dhaba POS Setup x.x.x.exe` | Run the installer, click Next |
| macOS | `Dhaba POS-x.x.x.dmg` | Drag to Applications |
| Linux | `Dhaba POS-x.x.x.AppImage` | Make executable (`chmod +x`), then run |

> The app works fully offline from the first launch. No internet connection required after installation.

---

## Features

- **Order Management** — create, update, and track orders in real time
- **Table Management** — visual table grid with booking status
- **Menu Management** — add/edit dishes with variants (Half / Full / Regular etc.)
  - Filter by type (Veg / Non-Veg) and category (Rice, Roti, Sabji, Drinks, and any custom categories)
  - "Available only" toggle to hide sold-out items during a busy shift
- **Billing & Invoicing** — auto-generated bills with tax, print-ready invoices
- **Dashboard** — daily earnings, popular dishes, recent orders at a glance
- **Customer Ledger** — track credit/balance for regular customers
- **Expenses Tracking** — log daily expenses by category
- **Consumables Tracking** — track tea, gutka, cigarette consumption by staff/customer/owner
- **Staff Management** — staff profiles, salary records, payment history
- **Data Management** *(Admin only)* — export data as JSON, CSV or Excel (XLSX), bulk delete by module and date range, live DB stats
- **Razorpay Integration** — online payment support (requires internet)
- **Splash screen** — animated launch screen showing startup progress
- **Auto-updater** — silent background updates via GitHub Releases
- **Fully offline** — SQLite database embedded on your machine, no cloud needed

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Desktop shell | Electron |
| Frontend | React, Redux Toolkit, Tailwind CSS, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite via `better-sqlite3` (embedded, zero-config) |
| Auth | JWT, bcrypt |
| State | Redux Toolkit + React Query |
| Payments | Razorpay |
| Export | SheetJS (`xlsx`) for Excel export |

---

## Developer Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Install dependencies

```bash
# Root (Electron + build tools)
npm install

# Backend
cd pos-backend && npm install

# Frontend
cd pos-frontend && npm install
```

### Run in development

```bash
# Terminal 1 — backend (Express on :5001)
cd pos-backend && npm run dev

# Terminal 2 — frontend (Vite on :5173)
cd pos-frontend && npm run dev

# Terminal 3 — open Electron window (optional, points to Vite dev server)
npm run electron:dev
```

> The SQLite database file is created automatically at startup. No separate database process needed.

### Seed the default menu (optional)

If the dish list is empty, the **Menu page** will show a "Load Default Menu" button that seeds the database in one click — no terminal needed.

To seed from the terminal instead:

```bash
cd pos-backend
npx tsx scripts/seedDishes.ts
```

This inserts ~30 typical dhaba dishes (roti, rice, sabji, drinks) and skips any that already exist. Images are left blank — update them via the UI later.

### Environment variables (backend)

Create `pos-backend/.env`:

```env
PORT=5001
DATABASE_PATH=./dhaba-pos.db    # path to the SQLite file (auto-created)
JWT_SECRET=your_secret_here
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
FRONTEND_URL=http://localhost:5173
```

> In the packaged desktop app, all secrets are auto-generated and managed by the app — no `.env` file needed.

---

## Build Installers

```bash
# Build everything (frontend + backend + Electron)
npm run build

# Package for your platform
npm run dist:mac      # → release/*.dmg
npm run dist:win      # → release/*.exe
npm run dist:linux    # → release/*.AppImage
```

> CI/CD via GitHub Actions builds for all three platforms on every version tag push (`v*`).

### Releasing a new version

Always bump `package.json` **before** creating the git tag so `app.getVersion()` shows the correct version in both dev and production:

```bash
# Patch release (1.4.0 → 1.4.1)
npm version patch

# Minor release (1.4.0 → 1.5.0)
npm version minor

# Major release (1.4.0 → 2.0.0)
npm version major
```

`npm version` bumps `package.json`, commits the change, and creates a matching git tag automatically. Then push both:

```bash
git push && git push --tags
```

GitHub Actions picks up the tag and builds installers for all three platforms.

---

## Project Structure

```
Bill-App/
├── electron/                  # Electron main process
│   ├── main.ts                # Sets up DATABASE_PATH, starts Express, manages splash + BrowserWindow
│   ├── preload.ts             # Context bridge (IPC for renderer)
│   ├── splash.html            # Animated launch/loading screen
│   └── splash-preload.ts      # Context bridge for splash window
├── pos-backend/               # Express + better-sqlite3 API
│   ├── app.ts                 # Express app setup (routes, middleware)
│   ├── server.ts              # Standalone entry: initDB + app.listen
│   ├── db/
│   │   ├── index.ts           # SQLite singleton (WAL mode, foreign keys)
│   │   └── schema.ts          # CREATE TABLE IF NOT EXISTS for all tables
│   ├── repositories/          # Typed data-access functions (one file per domain)
│   ├── controllers/           # HTTP request handlers
│   └── routes/
├── pos-frontend/              # React + Vite + TypeScript
│   └── src/
│       ├── types/             # Shared domain types
│       ├── redux/             # Store, slices, hooks
│       ├── components/
│       └── pages/
├── build-resources/           # App icons (icon.png / .ico / .icns)
├── electron-builder.yml       # Installer configuration
└── package.json               # Root: Electron + build scripts
```

---

## Roadmap

- [x] Order, table, menu, billing management
- [x] Customer ledger (credit tracking)
- [x] Expense tracking
- [x] Consumables tracking (tea, gutka, cigarette)
- [x] Staff management & salary payments
- [x] TypeScript migration (FE + BE)
- [x] Electron desktop app (offline, zero config)
- [x] SQLite migration (replaced MongoDB — instant startup, no extra binary)
- [x] Splash screen with startup progress
- [x] Auto-updater
- [x] Menu filters (Veg/Non-Veg, category, availability, search)
- [x] Data Management — export (JSON/CSV/XLSX), bulk delete, live DB stats
- [ ] Cloud sync / multi-device
- [ ] Print receipt directly from app
- [ ] Inventory / stock management

---

⭐ If this project helped you, give it a star!
