import { app, BrowserWindow, Menu, ipcMain, shell, screen } from "electron";
import path from "path";
import fs from "fs";

type RuntimeConfig = {
  hostAgentUrl: string;
  backendApiUrl: string;
  workerUrl: string;
  artifactDir: string;
  embedMode: string;
};

type HttpRequestPayload = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  expect?: "json" | "text";
};

type EmbedBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DockRectPayload = {
  serial?: string | null;
  avdName?: string | null;
  displayMode?: string;
  rect?: {
    left: number;
    top: number;
    width: number;
    height: number;
    devicePixelRatio?: number;
    scrollX?: number;
    scrollY?: number;
  };
  offsets?: {
    x?: number;
    y?: number;
    widthDelta?: number;
    heightDelta?: number;
  };
};

type WinEmbedBridge = {
  findWindowByPid: (pid: number) => string | null;
  findWindowByTitleContains: (needle: string) => string | null;
  setChildStyle: (childHwndHex: string) => boolean;
  attachWindow: (childHwndHex: string, parentHwndHex: string) => boolean;
  moveEmbeddedWindow: (childHwndHex: string, x: number, y: number, width: number, height: number) => boolean;
  detachWindow: (childHwndHex: string) => boolean;
  isWindowAlive: (childHwndHex: string) => boolean;
};

const embedState: {
  childHwndHex: string | null;
} = {
  childHwndHex: null
};

const nativeDockState: {
  active: boolean;
  mode: "stream" | "native-dock";
  lastPayload: DockRectPayload | null;
  lastWindow: BrowserWindow | null;
  timer: NodeJS.Timeout | null;
} = {
  active: false,
  mode: "stream",
  lastPayload: null,
  lastWindow: null,
  timer: null
};

let winEmbedBridge: WinEmbedBridge | null = null;

function loadWinEmbedBridge(): WinEmbedBridge | null {
  if (process.platform !== "win32") return null;
  try {
    const addonPath = path.resolve(__dirname, "..", "native", "winembed", "build", "Release", "winembed.node");
    if (!fs.existsSync(addonPath)) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const addon = require(addonPath) as WinEmbedBridge;
    return addon;
  } catch {
    return null;
  }
}

function parseNativeHandleToHex(handle: Buffer) {
  if (handle.length === 8) return handle.readBigUInt64LE(0).toString(16);
  if (handle.length === 4) return BigInt(handle.readUInt32LE(0)).toString(16);
  return BigInt(0).toString(16);
}

function toEmbeddedLocalBounds(bounds: EmbedBounds): EmbedBounds {
  // After SetParent, MoveWindow coordinates are relative to the new parent client area.
  return {
    x: Math.max(0, bounds.x),
    y: Math.max(0, bounds.y),
    width: Math.max(100, bounds.width),
    height: Math.max(100, bounds.height)
  };
}

async function findEmulatorWindowByPid(pid: number) {
  if (!winEmbedBridge || !pid) return null;

  const timeoutMs = 25000;
  const intervalMs = 350;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hwnd = winEmbedBridge.findWindowByPid(pid);
    if (hwnd) return hwnd;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function findEmulatorWindowByTitle() {
  if (!winEmbedBridge) return null;
  const timeoutMs = 12000;
  const intervalMs = 300;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const hwnd = winEmbedBridge.findWindowByTitleContains("Android Emulator");
    if (hwnd) return hwnd;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

function getRuntimeConfig(): RuntimeConfig {
  const artifactDir = process.env.ARTIFACT_DIR
    ? path.resolve(process.env.ARTIFACT_DIR)
    : path.resolve(process.cwd(), "artifacts");

  return {
    hostAgentUrl: process.env.HOST_AGENT_URL || "http://localhost:5050",
    backendApiUrl: process.env.BACKEND_API_URL || "http://localhost:4000",
    workerUrl: process.env.WORKER_URL || "http://localhost:6060",
    artifactDir,
    embedMode: process.env.EMBED_MODE || (process.platform === "win32" ? "force" : "stream")
  };
}

function envNumber(name: string, fallback = 0) {
  const raw = process.env[name];
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function resolveScreenRect(win: BrowserWindow, payload: DockRectPayload) {
  const rect = payload.rect;
  if (!rect) throw new Error("dock rect is required");
  const contentBounds = win.getContentBounds();
  const offsetX = Number.isFinite(Number(payload.offsets?.x)) ? Number(payload.offsets?.x) : envNumber("NATIVE_DOCK_OFFSET_X", 0);
  const offsetY = Number.isFinite(Number(payload.offsets?.y)) ? Number(payload.offsets?.y) : envNumber("NATIVE_DOCK_OFFSET_Y", 0);
  const widthDelta = Number.isFinite(Number(payload.offsets?.widthDelta)) ? Number(payload.offsets?.widthDelta) : envNumber("NATIVE_DOCK_WIDTH_DELTA", 0);
  const heightDelta = Number.isFinite(Number(payload.offsets?.heightDelta)) ? Number(payload.offsets?.heightDelta) : envNumber("NATIVE_DOCK_HEIGHT_DELTA", 0);
  const titlebarOffset = envNumber("NATIVE_DOCK_TITLEBAR_OFFSET", 0);

  return {
    x: Math.max(-10000, Math.min(10000, Math.round(contentBounds.x + rect.left + offsetX))),
    y: Math.max(-10000, Math.min(10000, Math.round(contentBounds.y + rect.top + titlebarOffset + offsetY))),
    width: Math.max(200, Math.min(8000, Math.round(rect.width + widthDelta))),
    height: Math.max(300, Math.min(8000, Math.round(rect.height + heightDelta)))
  };
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({ ok: false, message: `Non-JSON response from ${url}` }));
  return { ok: res.ok, status: res.status, data };
}

function createWindow(config: RuntimeConfig) {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  win.webContents.once("did-finish-load", () => {
    win.webContents.send("runtime:config", config);
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  return win;
}

function setAppMenu(win: BrowserWindow, config: RuntimeConfig) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { role: "reload", label: "Reload" },
        { type: "separator" },
        { role: "quit", label: "Quit" }
      ]
    },
    {
      label: "Runtime",
      submenu: [
        {
          label: "Refresh Status",
          click: () => {
            win.webContents.send("runtime:refresh");
          }
        },
        {
          label: "Open Artifacts Folder",
          click: async () => {
            const result = await shell.openPath(config.artifactDir);
            if (result) {
              win.webContents.send("runtime:error", `Unable to open artifacts folder: ${result}`);
            }
          }
        },
        { type: "separator" },
        {
          label: "Dock Native Emulator Window",
          click: () => {
            win.webContents.send("runtime:native-dock-action", { action: "dock" });
          }
        },
        {
          label: "Undock Native Emulator Window",
          click: () => {
            win.webContents.send("runtime:native-dock-action", { action: "undock" });
          }
        },
        {
          label: "Return to Stream",
          click: () => {
            win.webContents.send("runtime:native-dock-action", { action: "stream" });
          }
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            win.webContents.send("runtime:about", {
              appName: "Android Runtime MVP",
              version: app.getVersion()
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  winEmbedBridge = loadWinEmbedBridge();
  const config = getRuntimeConfig();
  ipcMain.handle("runtime:get-config", () => config);
  ipcMain.handle("runtime:open-artifacts-folder", async () => {
    const result = await shell.openPath(config.artifactDir);
    return result || "ok";
  });
  ipcMain.handle("runtime:http-request", async (_event, payload: HttpRequestPayload) => {
    const method = payload.method || "GET";
    const headers = payload.headers || {};
    const expect = payload.expect || "json";

    const init: RequestInit = {
      method,
      headers
    };

    if (payload.body !== undefined && payload.body !== null) {
      if (typeof payload.body === "string" || payload.body instanceof Uint8Array) {
        init.body = payload.body as BodyInit;
      } else {
        init.body = JSON.stringify(payload.body);
        if (!headers["Content-Type"] && !headers["content-type"]) {
          (init.headers as Record<string, string>)["Content-Type"] = "application/json";
        }
      }
    }

    const res = await fetch(payload.url, init);
    if (expect === "text") {
      const text = await res.text();
      return { ok: res.ok, status: res.status, data: text };
    }

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = { error: `Non-JSON response from ${payload.url}` };
    }
    return { ok: res.ok, status: res.status, data };
  });
  ipcMain.handle("runtime:emulator-attach", async (_event, payload: { pid: number; bounds: EmbedBounds }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return { ok: false, error: "No desktop window available." };

    if (process.platform !== "win32") {
      return { ok: false, error: "Native embedding is only supported on Windows in this release." };
    }
    if (!winEmbedBridge) {
      return { ok: false, error: "Windows embed bridge is unavailable. Rebuild desktop package." };
    }

    const emulatorHwnd = await findEmulatorWindowByPid(payload.pid);
    if (!emulatorHwnd) {
      return { ok: false, error: "Could not locate emulator window for embedding." };
    }

    const parentHwnd = parseNativeHandleToHex(win.getNativeWindowHandle());
    const screen = toEmbeddedLocalBounds(payload.bounds);
    const styleOk = winEmbedBridge.setChildStyle(emulatorHwnd);
    const attachOk = winEmbedBridge.attachWindow(emulatorHwnd, parentHwnd);
    const moveOk = winEmbedBridge.moveEmbeddedWindow(emulatorHwnd, screen.x, screen.y, screen.width, screen.height);
    if (!styleOk || !attachOk || !moveOk) {
      return {
        ok: false,
        error: `Embed bridge failed (style=${styleOk}, attach=${attachOk}, move=${moveOk})`
      };
    }
    embedState.childHwndHex = emulatorHwnd;

    return { ok: true };
  });
  ipcMain.handle("runtime:emulator-attach-running", async (_event, payload: { bounds: EmbedBounds }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return { ok: false, error: "No desktop window available." };
    if (process.platform !== "win32") return { ok: false, error: "Windows only." };
    if (!winEmbedBridge) return { ok: false, error: "Windows embed bridge unavailable." };

    const emulatorHwnd = await findEmulatorWindowByTitle();
    if (!emulatorHwnd) return { ok: false, error: "Running emulator window not found." };

    const parentHwnd = parseNativeHandleToHex(win.getNativeWindowHandle());
    const screen = toEmbeddedLocalBounds(payload.bounds);
    const styleOk = winEmbedBridge.setChildStyle(emulatorHwnd);
    const attachOk = winEmbedBridge.attachWindow(emulatorHwnd, parentHwnd);
    const moveOk = winEmbedBridge.moveEmbeddedWindow(emulatorHwnd, screen.x, screen.y, screen.width, screen.height);
    if (!styleOk || !attachOk || !moveOk) {
      return {
        ok: false,
        error: `Embed bridge failed (style=${styleOk}, attach=${attachOk}, move=${moveOk})`
      };
    }
    embedState.childHwndHex = emulatorHwnd;
    return { ok: true };
  });
  ipcMain.handle("runtime:emulator-resize", async (_event, payload: { bounds: EmbedBounds }) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win || !winEmbedBridge || !embedState.childHwndHex) {
      return { ok: false, error: "No embedded emulator to resize." };
    }

    if (!winEmbedBridge.isWindowAlive(embedState.childHwndHex)) {
      embedState.childHwndHex = null;
      return { ok: false, error: "Embedded emulator window is no longer available." };
    }

    const screen = toEmbeddedLocalBounds(payload.bounds);
    winEmbedBridge.moveEmbeddedWindow(embedState.childHwndHex, screen.x, screen.y, screen.width, screen.height);
    return { ok: true };
  });
  ipcMain.handle("runtime:emulator-detach", async () => {
    if (!winEmbedBridge || !embedState.childHwndHex) return { ok: true };
    winEmbedBridge.detachWindow(embedState.childHwndHex);
    embedState.childHwndHex = null;
    return { ok: true };
  });
  ipcMain.handle("native-dock:dock", async (event, payload: DockRectPayload) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return { ok: false, message: "Desktop window not available." };
    const screenRect = resolveScreenRect(win, payload);
    const req = {
      serial: payload?.serial || null,
      avdName: payload?.avdName || null,
      x: screenRect.x,
      y: screenRect.y,
      width: screenRect.width,
      height: screenRect.height
    };
    const result = await postJson(`${config.hostAgentUrl}/android/emulator/window/dock`, req);
    nativeDockState.lastPayload = payload;
    nativeDockState.lastWindow = win;
    nativeDockState.mode = "native-dock";
    nativeDockState.active = !!result.data?.ok;
    return { mode: "native-dock", ...result.data };
  });
  ipcMain.handle("native-dock:undock", async (_event, payload: DockRectPayload) => {
    const req = {
      serial: payload?.serial || null,
      avdName: payload?.avdName || null
    };
    const result = await postJson(`${config.hostAgentUrl}/android/emulator/window/undock`, req);
    nativeDockState.active = false;
    nativeDockState.mode = "stream";
    return { mode: "native-dock", ...result.data };
  });
  ipcMain.handle("native-dock:set-mode", async (_event, mode: "stream" | "native-dock") => {
    nativeDockState.mode = mode;
    if (mode === "stream") nativeDockState.active = false;
    return { ok: true, mode: nativeDockState.mode };
  });
  ipcMain.handle("native-dock:get-state", async () => {
    return {
      active: nativeDockState.active,
      mode: nativeDockState.mode,
      hasPayload: !!nativeDockState.lastPayload
    };
  });
  ipcMain.handle("native-dock:display-info", () => {
    return {
      offsets: {
        NATIVE_DOCK_OFFSET_X: envNumber("NATIVE_DOCK_OFFSET_X", 0),
        NATIVE_DOCK_OFFSET_Y: envNumber("NATIVE_DOCK_OFFSET_Y", 0),
        NATIVE_DOCK_WIDTH_DELTA: envNumber("NATIVE_DOCK_WIDTH_DELTA", 0),
        NATIVE_DOCK_HEIGHT_DELTA: envNumber("NATIVE_DOCK_HEIGHT_DELTA", 0),
        NATIVE_DOCK_TITLEBAR_OFFSET: envNumber("NATIVE_DOCK_TITLEBAR_OFFSET", 0)
      }
    };
  });

  const win = createWindow(config);
  setAppMenu(win, config);
  const scheduleWindowRedock = () => {
    if (!nativeDockState.active || !nativeDockState.lastPayload || !nativeDockState.lastWindow || nativeDockState.lastWindow.isMinimized()) return;
    if (nativeDockState.timer) clearTimeout(nativeDockState.timer);
    nativeDockState.timer = setTimeout(async () => {
      if (!nativeDockState.lastWindow || !nativeDockState.lastPayload) return;
      const screenRect = resolveScreenRect(nativeDockState.lastWindow, nativeDockState.lastPayload);
      const redockResult = await postJson(`${config.hostAgentUrl}/android/emulator/window/dock`, {
        serial: nativeDockState.lastPayload.serial || null,
        avdName: nativeDockState.lastPayload.avdName || null,
        x: screenRect.x,
        y: screenRect.y,
        width: screenRect.width,
        height: screenRect.height
      });
      if (!redockResult.data?.ok && nativeDockState.lastWindow && !nativeDockState.lastWindow.isDestroyed()) {
        nativeDockState.lastWindow.webContents.send("runtime:native-dock-redock-result", {
          ok: false,
          reason: redockResult.data?.reason,
          message: redockResult.data?.message || "Auto re-dock failed."
        });
      }
    }, 120);
  };
  win.on("move", scheduleWindowRedock);
  win.on("resize", scheduleWindowRedock);
  win.on("restore", scheduleWindowRedock);
  win.on("unmaximize", scheduleWindowRedock);
  screen.on("display-metrics-changed", scheduleWindowRedock);

  win.on("closed", () => {
    if (winEmbedBridge && embedState.childHwndHex) {
      try {
        winEmbedBridge.detachWindow(embedState.childHwndHex);
      } catch {
        // ignore best-effort cleanup
      }
      embedState.childHwndHex = null;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow(config);
      setAppMenu(newWin, config);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
