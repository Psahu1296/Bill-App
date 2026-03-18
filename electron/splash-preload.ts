import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("splashBridge", {
  onProgress: (cb: (data: { step: string; message: string; percent: number }) => void) => {
    ipcRenderer.on("splash:progress", (_e, data) => cb(data));
  },
  onVersion: (cb: (version: string) => void) => {
    ipcRenderer.on("splash:version", (_e, version) => cb(version));
  },
});
