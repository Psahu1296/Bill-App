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

> **First launch note:** The app downloads a small database engine (~70 MB) on its first start.
> An internet connection is required **only for this one-time download**. Everything works offline afterwards.

---

## Features

- **Order Management** — create, update, and track orders in real time
- **Table Management** — visual table grid with booking status
- **Menu Management** — add/edit dishes with variants (Half / Full / Regular etc.)
- **Billing & Invoicing** — auto-generated bills with tax, print-ready invoices
- **Dashboard** — daily earnings, popular dishes, recent orders at a glance
- **Customer Ledger** — track credit/balance for regular customers
- **Expenses Tracking** — log daily expenses by category
- **Razorpay Integration** — online payment support (requires internet)
- **Fully offline** — database runs embedded on your machine, no cloud needed

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Desktop shell | Electron |
| Frontend | React, Redux Toolkit, Tailwind CSS, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB (embedded via `mongodb-memory-server`, persistent) |
| Auth | JWT, bcrypt |
| State | Redux Toolkit + React Query |
| Payments | Razorpay |

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

### Seed Initial Data (Optional)

To populate the database with default menu items:

```bash
cd pos-backend
npx tsx scripts/script.ts
```

### Run in development

```bash
# Terminal 1 — local database (MongoDB on :27017)
node start-mongo.js

# Terminal 2 — backend (Express on :5000)
cd pos-backend && npm run dev

# Terminal 3 — frontend (Vite on :5173)
cd pos-frontend && npm run dev

# Terminal 4 — open Electron window (optional, points to Vite dev server)
npm run electron:dev
```

### Environment variables (backend)

Create `pos-backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/posdb   # local MongoDB for dev
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

> Cross-compiling for Windows from macOS requires [Wine](https://www.winehq.org/).
> Linux AppImage can be built on macOS without extra tools.

---

## Project Structure

```
Bill-App/
├── electron/            # Electron main process
│   ├── main.ts          # Starts MongoDB + Express + BrowserWindow
│   └── preload.ts       # Context bridge (v2: native dialogs, updates)
├── pos-backend/         # Express + Mongoose API
│   ├── app.ts           # Express app (no listen — imported by server.ts & Electron)
│   ├── server.ts        # Standalone entry: connectDB + app.listen
│   ├── controllers/
│   ├── models/
│   └── routes/
├── pos-frontend/        # React + Vite + TypeScript
│   └── src/
│       ├── types/       # Shared domain types
│       ├── redux/       # Store, slices, hooks
│       ├── components/
│       └── pages/
├── build-resources/     # App icons (icon.png / .ico / .icns)
├── electron-builder.yml # Installer configuration
└── package.json         # Root: Electron + build scripts
```

---

## Roadmap

- [x] Order, table, menu, billing management
- [x] Customer ledger (credit tracking)
- [x] Expense tracking
- [x] TypeScript migration (FE + BE)
- [x] Electron desktop app (offline, zero config)
- [x] Auto-updater (v2)
- [ ] Cloud sync / multi-device (v2)
- [ ] Print receipt directly from app (v2)
- [ ] Inventory / stock management (v2)

---

⭐ If this project helped you, give it a star!
