import { app, BrowserWindow, shell, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { autoUpdater } from "electron-updater";

const PORT = 5001;

const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;
let backendStarted = false;

// ── Updater helper ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendToRenderer(event: string, payload?: any) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("updater:status", { event, ...payload });
  }
}

// ── Splash helpers ────────────────────────────────────────────────────────────

function sendToSplash(step: string, message: string, percent: number) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send("splash:progress", { step, message, percent });
  }
  console.log(`[setup] ${message}`);
}

function createSplash(): BrowserWindow {
  const s = new BrowserWindow({
    width: 400,
    height: 460,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "splash-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  s.loadFile(path.join(__dirname, "../splash.html"));

  s.webContents.once("did-finish-load", () => {
    s.webContents.send("splash:version", app.getVersion());
  });

  return s;
}

// ── Backend setup ─────────────────────────────────────────────────────────────

async function setupBackend(): Promise<void> {
  if (backendStarted) return;
  backendStarted = true;

  const userDataPath = app.getPath("userData");

  // 1. Persistent JWT secret
  const secretFile = path.join(userDataPath, "jwt-secret.txt");
  let jwtSecret: string;
  if (fs.existsSync(secretFile)) {
    jwtSecret = fs.readFileSync(secretFile, "utf-8").trim();
  } else {
    jwtSecret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretFile, jwtSecret, "utf-8");
  }

  // 2. Environment variables — DATABASE_PATH tells better-sqlite3 where to store the file
  process.env["JWT_SECRET"]     = jwtSecret;
  process.env["NODE_ENV"]       = "production";
  process.env["PORT"]           = String(PORT);
  process.env["FRONTEND_URL"]   = `http://localhost:${PORT}`;
  process.env["DATABASE_PATH"]  = path.join(userDataPath, "dhaba-pos.db");

  sendToSplash("server", "Starting server…", 40);

  // 3. Load and start Express (SQLite opens automatically inside the server)
  // In production, the backend lives in resources/backend/ (extraResources) — NOT inside
  // the asar — so node_modules/express etc. are accessible as plain files on disk.
  const serverPath = isDev
    ? path.resolve(__dirname, "../pos-backend/dist/server.js")
    : path.join(process.resourcesPath, "backend/dist/server.js");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const startServer: (port: number) => Promise<void> = require(serverPath).default;
  await startServer(PORT);

  sendToSplash("server-ready", "Server started", 80);
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

  const url = isDev ? "http://localhost:5173" : `http://localhost:${PORT}`;
  win.loadURL(url);

  win.once("ready-to-show", () => {
    sendToSplash("done", "Ready!", 100);
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) { splash.close(); splash = null; }
      win?.show();
    }, 600);
  });

  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: "deny" };
  });

  win.on("closed", () => { win = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) {
    splash = createSplash();

    try {
      await setupBackend();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Backend startup failed:", message);
      if (splash && !splash.isDestroyed()) { splash.close(); splash = null; }
      dialog.showErrorBox(
        "Startup Error",
        `The application failed to start:\n\n${message}\n\nPlease reinstall the application or contact support.`
      );
      app.quit();
      return;
    }

    sendToSplash("server-ready", "Loading interface…", 90);
  }

  createWindow();

  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (win === null) createWindow();
});

// ── IPC: updater ──────────────────────────────────────────────────────────────

ipcMain.on("updater:check",   () => autoUpdater.checkForUpdates());
ipcMain.on("updater:download",() => autoUpdater.downloadUpdate());
ipcMain.on("updater:install", () => autoUpdater.quitAndInstall());

// ── Auto Updater Events ───────────────────────────────────────────────────────

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
  sendToRenderer("downloaded", { version: info.version });

  const result = await dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: `Dhaba POS v${info.version} is ready to install.`,
    detail: "Restart the app now to apply the update, or do it later from the App Update page.",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) autoUpdater.quitAndInstall();
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
  sendToRenderer("error", { message: err.message });
});
