import { app, BrowserWindow, shell, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import net from "net";
import http from "http";
import { execSync, spawn, ChildProcess } from "child_process";
import crypto from "crypto";
import { CustomAutoUpdater } from "./updater";
const autoUpdater = new CustomAutoUpdater();

let resolvedPort = 5002; // updated after .env is loaded — see below

// ── Port utilities ────────────────────────────────────────────────────────────

/** Try binding to the port. Resolves true if free, false if occupied. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => { probe.close(); resolve(true); });
    probe.listen(port, "127.0.0.1");
  });
}

/** GET /health and check for our fingerprint. */
function isOurBackend(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/health`,
      { timeout: 1500 },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(body)?.app === "dhaba-pos"); }
          catch { resolve(false); }
        });
      }
    );
    req.on("error",   () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

/** Kill whatever process is listening on `port` (cross-platform). */
function killProcessOnPort(port: number): void {
  try {
    if (process.platform === "win32") {
      // netstat output: "  TCP    0.0.0.0:5001    0.0.0.0:0    LISTENING    1234"
      const raw = execSync("netstat -ano -p TCP", { encoding: "utf-8", timeout: 4000 });
      const pids = new Set<string>();
      for (const line of raw.split("\n")) {
        const parts = line.trim().split(/\s+/);
        // parts[1] is LocalAddress, parts[4] is PID
        if (parts.length >= 5 && parts[1]?.endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
        }
      }
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { timeout: 3000 });
        console.log(`[port] Killed PID ${pid} (was on port ${port})`);
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { timeout: 4000 });
      console.log(`[port] Killed process(es) on port ${port}`);
    }
  } catch (err) {
    console.warn(`[port] killProcessOnPort(${port}) failed:`, err);
  }
}

/** Scan upward until we find a free port. */
async function findFreePort(start: number, max = 30): Promise<number> {
  for (let p = start; p < start + max; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port found in range ${start}–${start + max - 1}`);
}

/**
 * Decide which port to use:
 *  - Preferred is free → use it
 *  - Preferred is ours (leftover process) → kill it, reuse preferred
 *  - Preferred is foreign → find next free port
 */
async function resolvePort(preferred: number): Promise<number> {
  if (await isPortFree(preferred)) return preferred;

  if (await isOurBackend(preferred)) {
    sendToSplash("server", `Port ${preferred} held by previous instance — restarting…`, 28);
    killProcessOnPort(preferred);
    // Give OS a moment to release the port
    await new Promise((r) => setTimeout(r, 900));
    // If still not free after killing, fall through to next port
    if (await isPortFree(preferred)) return preferred;
  }

  const next = await findFreePort(preferred + 1);
  sendToSplash("server", `Port ${preferred} in use — switching to ${next}…`, 28);
  return next;
}

const isDev = !app.isPackaged;

// ── Env loader ────────────────────────────────────────────────────────────────

/**
 * Minimal .env parser — loads key=value pairs without overriding already-set
 * process.env vars (same behaviour as dotenv). Used to read CLOUDFLARE_* vars
 * in both dev (pos-backend/.env) and production (resources/backend/.env).
 */
function loadEnvFile(): void {
  const envPath = isDev
    ? path.resolve(__dirname, "../../pos-backend/.env")
    : path.join(process.resourcesPath, "backend/.env");

  if (!fs.existsSync(envPath)) return;

  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.warn("[env] Failed to load .env:", e);
  }
}

loadEnvFile();

let win: BrowserWindow | null = null;
let splash: BrowserWindow | null = null;
let backendStarted = false;
let tunnelProcess: ChildProcess | null = null;
let tunnelUrl = "";

// ── Cloudflare Tunnel ─────────────────────────────────────────────────────────

/** Resolve the cloudflared binary: packaged resources first, then system PATH. */
function cloudflaredBin(): string {
  if (!isDev) {
    const ext  = process.platform === "win32" ? ".exe" : "";
    const candidate = path.join(process.resourcesPath, "cloudflared", `cloudflared${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back to system-installed binary (Homebrew / winget / apt)
  return "cloudflared";
}

/**
 * Starts the named Cloudflare tunnel using the token from env.
 * URL is fixed (configured in Cloudflare dashboard) — no need to parse stdout.
 * Resolves once cloudflared reports a registered connection, or after 20 s
 * if the process is still alive (assumes tunnel is up but log format changed).
 */
function startCloudflaredTunnel(): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = process.env.CLOUDFLARE_TUNNEL_TOKEN || "";
    const fixedUrl = process.env.CLOUDFLARE_TUNNEL_URL || "";

    if (!token || !fixedUrl) {
      reject(new Error("CLOUDFLARE_TUNNEL_TOKEN or CLOUDFLARE_TUNNEL_URL not set in .env"));
      return;
    }

    const bin = cloudflaredBin();
    sendToSplash("tunnel", "Starting Cloudflare tunnel…", 85);

    tunnelProcess = spawn(bin, ["tunnel", "run", "--token", token], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resolved = false;

    const tryResolve = (data: Buffer) => {
      if (resolved) return;
      const text = data.toString();
      console.log("[cloudflared]", text.trimEnd());
      // Named tunnel prints this once the connection is live
      if (
        text.includes("Registered tunnel connection") ||
        text.includes("Connection established") ||
        text.includes("connIndex=0")
      ) {
        resolved = true;
        tunnelUrl = fixedUrl;
        resolve(fixedUrl);
      }
    };

    tunnelProcess.stdout?.on("data", tryResolve);
    tunnelProcess.stderr?.on("data", tryResolve);

    tunnelProcess.on("error", (err) => {
      if (!resolved) reject(new Error(`cloudflared not found: ${err.message}`));
    });

    tunnelProcess.on("exit", (code) => {
      if (!resolved) reject(new Error(`cloudflared exited with code ${code}`));
    });

    // Fallback: if process is still running after 20 s, assume tunnel is up
    setTimeout(() => {
      if (!resolved && tunnelProcess && !tunnelProcess.killed) {
        resolved = true;
        tunnelUrl = fixedUrl;
        resolve(fixedUrl);
      } else if (!resolved) {
        reject(new Error("Cloudflare tunnel timed out after 20 s"));
      }
    }, 20_000);
  });
}

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

  // 2. Resolve port — kill stale own instance or find next free port
  sendToSplash("server", "Checking port…", 25);
  // Use the PORT from .env so the backend matches the port the Cloudflare
  // named tunnel is configured to forward to. Falls back to 5002.
  const preferredPort = parseInt(process.env.PORT ?? "5002", 10);
  resolvedPort = await resolvePort(preferredPort);

  // 3. Environment variables — DATABASE_PATH tells better-sqlite3 where to store the file
  process.env["JWT_SECRET"]          = jwtSecret;
  process.env["NODE_ENV"]            = "production";
  process.env["PORT"]                = String(resolvedPort);
  process.env["FRONTEND_URL"]        = `http://localhost:${resolvedPort}`;
  process.env["DATABASE_PATH"]       = path.join(userDataPath, "dhaba-pos.db");
  process.env["FRONTEND_DIST_PATH"]  = path.join(process.resourcesPath, "frontend/dist");

  sendToSplash("server", `Starting server on port ${resolvedPort}…`, 40);

  // 4. Load and start Express (SQLite opens automatically inside the server)
  // In production, the backend lives in resources/backend/ (extraResources) — NOT inside
  // the asar — so node_modules/express etc. are accessible as plain files on disk.
  const serverPath = isDev
    ? path.resolve(__dirname, "../pos-backend/dist/server.js")
    : path.join(process.resourcesPath, "backend/dist/server.js");

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const startServer: (port: number) => Promise<void> = require(serverPath).default;
  await startServer(resolvedPort);

  sendToSplash("server-ready", "Server started", 80);
}

async function setupTunnel(): Promise<void> {
  try {
    const url = await startCloudflaredTunnel();
    // Persist URL so the renderer can read it via IPC
    const urlFile = path.join(app.getPath("userData"), "tunnel-url.txt");
    fs.writeFileSync(urlFile, url, "utf-8");
    // Let the renderer know the URL is ready
    win?.webContents.send("tunnel:url", url);
    sendToSplash("tunnel-ready", `Tunnel ready: ${url}`, 95);
    console.log("[tunnel] URL:", url);
  } catch (err) {
    // Tunnel failure is non-fatal — POS still works locally
    console.warn("[tunnel] Could not start:", (err as Error).message);
    win?.webContents.send("tunnel:url", null);
  }
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

  const url = isDev ? "http://localhost:5173" : `http://localhost:${resolvedPort}`;
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

  // Start tunnel after window is created so we can send IPC events to it.
  // Non-blocking — POS works regardless of tunnel status.
  if (!isDev) setupTunnel();

  if (!isDev) {
    autoUpdater.autoDownload    = false; // wait for user to click "Download"
    autoUpdater.autoInstallOnAppQuit = false; // only install when user triggers it
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
});

app.on("window-all-closed", () => {
  // Kill the cloudflared tunnel process so it doesn't linger after the app closes
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill();
    tunnelProcess = null;
  }
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

// ── IPC: server status ────────────────────────────────────────────────────────

ipcMain.handle("server:info", () => ({
  resolvedPort,
  preferredPort: parseInt(process.env.PORT ?? "5002", 10),
  tunnelUrl:     tunnelUrl || null,
  tunnelRunning: !!(tunnelProcess && !tunnelProcess.killed),
}));

ipcMain.on("tunnel:restart", async () => {
  if (tunnelProcess && !tunnelProcess.killed) {
    tunnelProcess.kill();
    tunnelProcess = null;
    tunnelUrl = "";
    win?.webContents.send("tunnel:url", null);
  }
  if (!isDev) await setupTunnel();
});

// Renderer can request current tunnel URL at any time (e.g. on page load)
ipcMain.handle("tunnel:get-url", () => tunnelUrl || null);

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

autoUpdater.on("update-downloaded", (info) => {
  console.log(`Update downloaded: v${info.version}`);
  // Notify the UI — the AppUpdate page "Restart & Install" button triggers install.
  sendToRenderer("downloaded", { version: info.version });
});

autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
  sendToRenderer("error", { message: err.message });
});
