import { app, BrowserWindow, shell, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { CustomAutoUpdater } from "./updater";
const autoUpdater = new CustomAutoUpdater();

const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;// ── Updater helper ────────────────────────────────────────────────────────────

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
    show: isDev,      // show immediately in dev; production waits for ready-to-show
    autoHideMenuBar: true,
  });

  // When isDev is true, you can connect to the local dev server.
  // Otherwise, load the live Railway domain.
  // Set your Railway URL or load the built static files via custom protocol if you prefer offline mode.
  const liveUrl = process.env.VITE_FRONTEND_URL || "https://sahudhaba.in";
  const url = isDev ? "http://localhost:5173" : liveUrl;
  win.loadURL(url);

  // Open DevTools once on first load in dev — not on every HMR reload
  if (isDev) {
    win.webContents.once("did-finish-load", () => win?.webContents.openDevTools());
  }

  win.once("ready-to-show", () => {
    sendToSplash("done", "Ready!", 100);
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) { splash.close(); splash = null; }
      if (!isDev) win?.show();
    }, 600);
  });

  win.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: "deny" };
  });

  win.on("closed", () => { win = null; });

  // F12 toggles DevTools in production for on-site debugging
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      win?.webContents.isDevToolsOpened()
        ? win.webContents.closeDevTools()
        : win?.webContents.openDevTools();
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!isDev) {
    splash = createSplash();

    sendToSplash("server-ready", "Loading interface…", 90);
  }

  createWindow();

  // App starts without bundled backend

  if (!isDev) {
    autoUpdater.autoDownload    = false; // wait for user to click "Download"
    autoUpdater.autoInstallOnAppQuit = false; // only install when user triggers it
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

ipcMain.on("updater:check", async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err: any) {
    sendToRenderer("error", { message: err?.message ?? "Failed to check for updates" });
  }
});

ipcMain.on("updater:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err: any) {
    sendToRenderer("error", { message: err?.message ?? "Failed to download update" });
  }
});

ipcMain.on("updater:install", () => {
  try {
    autoUpdater.quitAndInstall();
  } catch (err: any) {
    sendToRenderer("error", { message: err?.message ?? "Failed to install update" });
  }
});

ipcMain.on("shell:open-external", (_event, url: string) => {
  shell.openExternal(url).catch(console.error);
});

// ── IPC: migration ────────────────────────────────────────────────────────────

ipcMain.handle("migrate:run", async () => {
  const dbPath = path.join(app.getPath("userData"), "dhaba-pos.db");
  if (!fs.existsSync(dbPath)) {
    return { success: false, message: "No legacy dhaba-pos.db database found on this machine." };
  }
  
  try {
    const liveUrl = process.env.VITE_FRONTEND_URL || "https://sahudhaba.in";
    const uploadUrl = isDev ? "http://localhost:5001/api/migration/upload" : `${liveUrl}/api/migration/upload`;
    
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(dbPath);
    // Node.js 18+ Blob polyfill natively supports this
    const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
    formData.append("database", blob, "dhaba-pos.db");

    const res = await fetch(uploadUrl, { method: "POST", body: formData });
    const json = await res.json().catch(() => ({}));
    
    if (res.ok && json.success) {
      // Clean up the local legacy file so it's not repeatedly attempted
      try { fs.renameSync(dbPath, dbPath + ".migrated"); } catch(e){}
      return { success: true, message: json.message };
    } else {
      return { success: false, message: json.message || "Migration server returned an error." };
    }
  } catch (error: any) {
    console.error("Migration error:", error);
    return { success: false, message: error.message };
  }
});

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

autoUpdater.on("update-downloaded", (info) => {
  console.log(`Update downloaded: v${info.version}`);
  // Notify the UI — the AppUpdate page "Restart & Install" button triggers install.
  sendToRenderer("downloaded", { version: info.version });
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
  sendToRenderer("error", { message: err.message });
});
