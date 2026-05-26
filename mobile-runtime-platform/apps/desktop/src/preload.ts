import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopBridge", {
  version: "0.1.0",
  getRuntimeConfig: () => ipcRenderer.invoke("runtime:get-config"),
  openArtifactsFolder: () => ipcRenderer.invoke("runtime:open-artifacts-folder"),
  httpRequest: (payload: unknown) => ipcRenderer.invoke("runtime:http-request", payload),
  emulatorAttach: (payload: unknown) => ipcRenderer.invoke("runtime:emulator-attach", payload),
  emulatorAttachRunning: (payload: unknown) => ipcRenderer.invoke("runtime:emulator-attach-running", payload),
  emulatorResize: (payload: unknown) => ipcRenderer.invoke("runtime:emulator-resize", payload),
  emulatorDetach: () => ipcRenderer.invoke("runtime:emulator-detach"),
  onRuntimeConfig: (handler: (config: unknown) => void) => ipcRenderer.on("runtime:config", (_e, data) => handler(data)),
  onRuntimeRefresh: (handler: () => void) => ipcRenderer.on("runtime:refresh", () => handler()),
  onRuntimeError: (handler: (message: string) => void) => ipcRenderer.on("runtime:error", (_e, message) => handler(message)),
  onAbout: (handler: (data: { appName: string; version: string }) => void) => ipcRenderer.on("runtime:about", (_e, data) => handler(data))
});
