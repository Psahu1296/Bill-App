/**
 * Custom auto-updater — no code signing required.
 *
 * Checks the GitHub Releases API for a newer version, downloads the
 * platform-appropriate installer to the OS temp directory, and launches it.
 * Emits the same events as electron-updater so main.ts needs no changes.
 */

import { app, shell } from "electron";
import { EventEmitter } from "events";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

const GITHUB_OWNER = "Psahu1296";
const GITHUB_REPO  = "Bill-App";
const API_URL      = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface ReleaseInfo {
  version: string;
  releaseNotes?: string;
  asset: ReleaseAsset;
}

// ── Semver comparison ─────────────────────────────────────────────────────────

function parseSemver(v: string): [number, number, number] {
  const [maj = 0, min = 0, pat = 0] = v
    .replace(/^v/, "")
    .split(".")
    .map(Number);
  return [maj, min, pat];
}

/** Returns > 0 if a is newer than b */
function compareVersions(a: string, b: string): number {
  const [aMaj, aMin, aPat] = parseSemver(a);
  const [bMaj, bMin, bPat] = parseSemver(b);
  return aMaj !== bMaj ? aMaj - bMaj
       : aMin !== bMin ? aMin - bMin
       : aPat - bPat;
}

// ── Asset selection ───────────────────────────────────────────────────────────

function selectAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  const { platform, arch } = process;

  if (platform === "win32") {
    // e.g. Dhaba.POS.Setup.1.5.2.exe
    return assets.find(a => a.name.endsWith(".exe") && !a.name.endsWith(".blockmap"));
  }

  if (platform === "darwin") {
    const dmgs = assets.filter(a => a.name.endsWith(".dmg"));
    if (arch === "arm64") {
      return dmgs.find(a => a.name.includes("arm64")) ?? dmgs[0];
    }
    // x64 — prefer explicit x64 tag, fall back to any DMG without arm64
    return (
      dmgs.find(a => a.name.includes("x64")) ??
      dmgs.find(a => !a.name.includes("arm64")) ??
      dmgs[0]
    );
  }

  // Linux — AppImage
  return assets.find(a => a.name.endsWith(".AppImage"));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function getJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": `${GITHUB_REPO}-updater`, "Accept": "application/vnd.github.v3+json" } }, (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch (e) { reject(e); }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function downloadFile(
  url: string,
  dest: string,
  onProgress: (p: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let transferred = 0;

    function doGet(reqUrl: string): void {
      const mod: typeof https | typeof http = reqUrl.startsWith("https") ? https : http;
      mod
        .get(reqUrl, (res) => {
          // Follow redirects (GitHub asset downloads redirect to S3)
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
            doGet(res.headers.location as string);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${res.statusCode}`));
            return;
          }

          const total = parseInt(res.headers["content-length"] ?? "0", 10);
          const file  = fs.createWriteStream(dest);

          res.on("data", (chunk: Buffer) => {
            transferred += chunk.length;
            const elapsed        = (Date.now() - startTime) / 1000 || 0.001;
            const bytesPerSecond = transferred / elapsed;
            const percent        = total > 0 ? (transferred / total) * 100 : 0;
            onProgress({ percent, transferred, total, bytesPerSecond });
          });

          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
          file.on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
          res.on("error", reject);
        })
        .on("error", reject);
    }

    doGet(url);
  });
}

// ── Updater class ─────────────────────────────────────────────────────────────

export class CustomAutoUpdater extends EventEmitter {
  /** Set to false to require manual download (matches electron-updater default) */
  autoDownload = false;
  autoInstallOnAppQuit = false;

  private pending: ReleaseInfo | null = null;
  private downloadedPath: string | null = null;

  async checkForUpdates(): Promise<void> {
    this.emit("checking-for-update");
    try {
      const json = await getJSON(API_URL);
      if (json.message) throw new Error(`GitHub API error: ${json.message}`);

      const version = (json.tag_name as string)?.replace(/^v/, "") ?? "";
      const asset   = selectAsset(json.assets ?? []);

      if (!asset) {
        throw new Error(
          `No installer asset found for ${process.platform}/${process.arch} in release ${version}`
        );
      }

      const current = app.getVersion();

      if (compareVersions(version, current) > 0) {
        this.pending = {
          version,
          releaseNotes: typeof json.body === "string" ? json.body : undefined,
          asset,
        };
        this.emit("update-available", {
          version: this.pending.version,
          releaseNotes: this.pending.releaseNotes,
        });
      } else {
        this.emit("update-not-available", { version: current });
      }
    } catch (err: any) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!this.pending) {
      this.emit("error", new Error("No update available to download"));
      return;
    }

    try {
      const dest = path.join(os.tmpdir(), this.pending.asset.name);
      await downloadFile(this.pending.asset.browser_download_url, dest, (p) => {
        this.emit("download-progress", p);
      });
      this.downloadedPath = dest;
      this.emit("update-downloaded", { version: this.pending.version });
    } catch (err: any) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  quitAndInstall(): void {
    if (!this.downloadedPath) {
      this.emit("error", new Error("No update downloaded yet"));
      return;
    }

    const installer = this.downloadedPath;

    if (process.platform === "win32") {
      // Spawn the NSIS installer detached so it survives the app exiting
      spawn(installer, [], { detached: true, stdio: "ignore" }).unref();
      app.quit();
      return;
    }

    if (process.platform === "darwin") {
      // Open the DMG — Finder shows it; user drags app to Applications
      shell.openPath(installer).then(() => app.quit());
      return;
    }

    // Linux: make AppImage executable and open its containing folder
    try { fs.chmodSync(installer, 0o755); } catch { /* ignore */ }
    shell.openPath(path.dirname(installer)).then(() => app.quit());
  }
}
