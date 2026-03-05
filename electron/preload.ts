import { contextBridge } from "electron";

// Expose only what the renderer actually needs.
// Add more here in v2 (e.g. auto-updater events, native file dialogs).
contextBridge.exposeInMainWorld("appBridge", {
  platform: process.platform,
});
