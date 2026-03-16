import { contextBridge, ipcRenderer } from "electron";

// All update events the renderer can receive from the main process
type UpdateStatus =
  | { event: "checking" }
  | { event: "available"; version: string; releaseNotes?: string }
  | { event: "not-available"; version: string }
  | { event: "progress"; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { event: "downloaded"; version: string }
  | { event: "error"; message: string };

contextBridge.exposeInMainWorld("appBridge", {
  // ── Platform info ──────────────────────────────────────────────────────────
  platform: process.platform,

  // ── Auto-updater controls ──────────────────────────────────────────────────
  /** Ask the main process to start checking for a new release */
  checkForUpdates: () => ipcRenderer.send("updater:check"),

  /** Ask the main process to download the available update */
  downloadUpdate: () => ipcRenderer.send("updater:download"),

  /** Quit and install the downloaded update immediately */
  installUpdate: () => ipcRenderer.send("updater:install"),

  /**
   * Subscribe to update lifecycle events from the main process.
   * Returns an unsubscribe function — call it in useEffect cleanup.
   */
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: UpdateStatus) =>
      callback(status);
    ipcRenderer.on("updater:status", handler);
    // Return cleanup so React can remove the listener on unmount
    return () => ipcRenderer.removeListener("updater:status", handler);
  },
});
