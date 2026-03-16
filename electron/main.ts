import { app, BrowserWindow, shell, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { autoUpdater } from "electron-updater";

const PORT = 5001;

// In dev mode Electron loads the Vite dev server; backend is started separately.
// In production (packaged) mode Electron starts everything itself.
const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;
let backendStarted = false;

// ── Updater helper: push events to the renderer window ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToRenderer(event: string, payload?: any) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("updater:status", { event, ...payload });
  }
}

// ── Backend + MongoDB setup ────────────────────────────────────────────────────

async function setupBackend(): Promise<void> {
  if (backendStarted) return;
  backendStarted = true;

  const userDataPath = app.getPath("userData");

  // 1. Generate (or load) a persistent JWT secret so tokens survive restarts
  const secretFile = path.join(userDataPath, "jwt-secret.txt");
  let jwtSecret: string;
  if (fs.existsSync(secretFile)) {
    jwtSecret = fs.readFileSync(secretFile, "utf-8").trim();
  } else {
    jwtSecret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, jwtSecret, "utf-8");
  }

  // 2. Set ALL env vars BEFORE requiring backend modules.
  //    CJS require() is lazy — modules evaluate at this point, so they see these values.
  process.env["JWT_SECRET"] = jwtSecret;
  process.env["NODE_ENV"] = "production";
  process.env["PORT"] = String(PORT);
  process.env["FRONTEND_URL"] = `http://localhost:${PORT}`;

// 3. Start embedded MongoDB with a persistent data directory.
    //    On first launch the MongoDB binary is downloaded once (~70 MB) and cached.
    const dbDataPath = path.join(userDataPath, "mongodb-data");
    const binaryPath = path.join(userDataPath, "mongodb-binaries");
    fs.mkdirSync(dbDataPath, { recursive: true });
    fs.mkdirSync(binaryPath, { recursive: true });

    process.env["MONGOMS_DOWNLOAD_DIR"] = binaryPath;
    process.env["MONGOMS_VERSION"] = "7.0.14";
    process.env["MONGOMS_PREFER_GLOBAL_PATH"] = "0";

    console.log("🔄 Setting up embedded database...");
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MongoMemoryServer } = require("mongodb-memory-server");
    let mongod;
    try {
      mongod = await MongoMemoryServer.create({
        instance: {
          dbPath: dbDataPath,
          storageEngine: "wiredTiger",
        },
        downloadDir: binaryPath,
      });
      process.env["MONGODB_URI"] = mongod.getUri();
      console.log("✅ Database initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize database:", error);
      throw new Error("Database initialization failed. Please check your internet connection and try again.");
    }

  // 4. Load and start the Express backend.
  //    Path differs between dev (source tree) and packaged (app resources).
  const serverPath = isDev
    ? path.resolve(__dirname, "../pos-backend/dist/server.js")
    : path.join(app.getAppPath(), "pos-backend/dist/server.js");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const startServer: (port: number) => Promise<void> = require(serverPath).default;
  await startServer(PORT);
}

// ── Window creation ───────────────────────────────────────────────────────────

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    autoHideMenuBar: true,
  });

  // Dev → load Vite dev server (proxy handles /api/* → backend)
  // Production → Express serves both the API and the built frontend
  const url = isDev
    ? "http://localhost:5173"
    : `http://localhost:${PORT}`;

  win.loadURL(url);

  win.once("ready-to-show", () => {
    win?.show();
  });

  // Open external links (e.g. Razorpay) in the system browser, not Electron
  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) {
    await setupBackend();
  }
  createWindow();

  // Check for updates silently after the window is ready (production only)
  if (!isDev) {
    // Small delay so the window is visible before any update UI appears
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
});

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Re-create window on macOS when dock icon is clicked with no open windows
app.on("activate", () => {
  if (win === null) createWindow();
});

// ── IPC handlers: renderer → main ─────────────────────────────────────────────
// These are triggered by window.appBridge.checkForUpdates() etc. in the page.

ipcMain.on("updater:check", () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on("updater:download", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on("updater:install", () => {
  autoUpdater.quitAndInstall();
});

// ── Auto Updater Events: main → renderer ──────────────────────────────────────
// All events are forwarded to the renderer via sendToRenderer() so AppUpdate.tsx
// can react to the real update lifecycle without any simulation.

autoUpdater.on("checking-for-update", () => {
  console.log("Checking for update...");
  sendToRenderer("checking");
});

autoUpdater.on("update-available", (info) => {
  console.log(`Update available: v${info.version}`);
  sendToRenderer("available", {
    version: info.version,
    releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
  });
});

autoUpdater.on("update-not-available", (info) => {
  console.log(`Already up to date: v${info.version}`);
  sendToRenderer("not-available", { version: info.version });
});

autoUpdater.on("download-progress", (progress) => {
  sendToRenderer("progress", {
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  });
});

autoUpdater.on("update-downloaded", async (info) => {
  console.log(`Update downloaded: v${info.version}`);
  // Notify the renderer that the update is ready to install
  sendToRenderer("downloaded", { version: info.version });

  // Also show a native OS dialog as a fallback (e.g. if the user is not on the update page)
  const result = await dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: `Dhaba POS v${info.version} is ready to install.`,
    detail: "Restart the app now to apply the update, or do it later from the App Update page.",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    autoUpdater.quitAndInstall();
  }
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
  sendToRenderer("error", { message: err.message });
});
