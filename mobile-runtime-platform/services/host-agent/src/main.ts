import express from "express";
import cors from "cors";
import { DefaultRuntimeHostAdapter } from "./adapters/runtime-host-adapter";
import { AndroidSdkService } from "./android/android-sdk-service";
import { EmulatorService } from "./android/emulator-service";
import { AdbService } from "./android/adb-service";

const app = express();
app.use(cors());
app.use(express.json());

const adapter = new DefaultRuntimeHostAdapter();
const sdkService = new AndroidSdkService(adapter);
const emulatorService = new EmulatorService(sdkService, new AdbService(sdkService));
const adbService = new AdbService(sdkService);
const INPUT_KEY_MAP: Record<string, string> = {
  BACK: "KEYCODE_BACK",
  HOME: "KEYCODE_HOME",
  RECENTS: "KEYCODE_APP_SWITCH",
  ENTER: "KEYCODE_ENTER",
  DELETE: "KEYCODE_DEL",
  TAB: "KEYCODE_TAB",
  ESCAPE: "KEYCODE_ESCAPE",
  POWER: "KEYCODE_POWER"
};

function asClampedInt(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sanitizeTextInput(raw: string) {
  const withoutControlChars = raw.replace(/[\u0000-\u001F\u007F]/g, "");
  return withoutControlChars.slice(0, 500);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "host-agent", port: 5050 });
});

app.get("/host/info", (_req, res) => {
  res.json({
    hostOs: adapter.getHostOs(),
    platform: process.platform,
    arch: process.arch,
    unsupported: adapter.getHostOs() === "unsupported"
  });
});

app.get("/android/sdk/status", (_req, res) => {
  res.json(sdkService.getStatus());
});

app.get("/android/avds", async (_req, res) => {
  try {
    const avds = await emulatorService.listAvds();
    res.json({ avds });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list AVDs" });
  }
});

app.get("/android/devices", async (_req, res) => {
  try {
    const devices = await adbService.listDevices();
    const withBoot = await Promise.all(
      devices.map(async (d) => ({ ...d, bootCompleted: d.state === "device" ? await adbService.isBootCompleted(d.serial) : false }))
    );
    res.json({ devices: withBoot });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list adb devices" });
  }
});

app.post("/android/emulator/start", async (req, res) => {
  const avdName = String(req.body?.avdName || "").trim();
  if (!avdName) {
    res.status(400).json({ error: "avdName is required" });
    return;
  }

  try {
    const result = await emulatorService.startEmulator(avdName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start emulator" });
  }
});

app.post("/android/emulator/stop", async (req, res) => {
  try {
    const serial = req.body?.serial ? String(req.body.serial) : undefined;
    const result = await emulatorService.stopEmulator(serial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to stop emulator" });
  }
});

app.get("/android/display/frame", async (req, res) => {
  const serial = String(req.query.serial || "").trim();
  if (!serial) {
    res.status(400).json({ error: "serial query param is required" });
    return;
  }

  try {
    const png = await adbService.screencapPng(serial);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(png);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to capture display frame" });
  }
});

app.get("/android/display/metrics", async (req, res) => {
  const serial = String(req.query.serial || "").trim();
  if (!serial) {
    res.status(400).json({ error: "serial query param is required" });
    return;
  }

  try {
    const size = await adbService.getDisplaySize(serial);
    res.json(size);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get display metrics" });
  }
});

app.get("/android/device/:serial/info", async (req, res) => {
  const serial = String(req.params.serial || "").trim();
  if (!serial) {
    res.status(400).json({ error: "serial is required" });
    return;
  }
  try {
    const devices = await adbService.listDevices();
    const found = devices.find((d) => d.serial === serial);
    if (!found) {
      res.status(404).json({ error: `device not found: ${serial}` });
      return;
    }
    const bootCompleted = found.state === "device" ? await adbService.isBootCompleted(serial) : false;
    let width = 1080;
    let height = 1920;
    try {
      const size = await adbService.getDisplaySize(serial);
      width = size.width || width;
      height = size.height || height;
    } catch {
      // default dimensions are returned on parse/fetch failure
    }
    res.json({
      serial,
      state: found.state,
      bootCompleted,
      width,
      height
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get device info" });
  }
});

app.post("/android/input/tap", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const x = asClampedInt(req.body?.x, 0);
  const y = asClampedInt(req.body?.y, 0);
  if (!serial || x === null || y === null) {
    res.status(400).json({ error: "serial, x, y are required" });
    return;
  }

  try {
    await adbService.tap(serial, x, y);
    res.json({ ok: true, action: "tap", serial, x, y });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send tap input" });
  }
});

app.post("/android/input/swipe", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const x1 = asClampedInt(req.body?.x1, 0);
  const y1 = asClampedInt(req.body?.y1, 0);
  const x2 = asClampedInt(req.body?.x2, 0);
  const y2 = asClampedInt(req.body?.y2, 0);
  const durationMs = asClampedInt(req.body?.durationMs ?? 350, 50, 3000);

  if (!serial || x1 === null || y1 === null || x2 === null || y2 === null || durationMs === null) {
    res.status(400).json({ error: "serial, x1, y1, x2, y2 are required" });
    return;
  }

  try {
    await adbService.swipe(serial, x1, y1, x2, y2, durationMs);
    res.json({ ok: true, action: "swipe", serial });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send swipe input" });
  }
});

app.post("/android/input/text", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const text = sanitizeTextInput(String(req.body?.text || ""));
  if (!serial || !text.trim()) {
    res.status(400).json({ error: "serial and text are required" });
    return;
  }
  if (text.length > 500) {
    res.status(400).json({ error: "text must be <= 500 chars" });
    return;
  }

  try {
    await adbService.inputText(serial, text);
    res.json({ ok: true, action: "text", length: text.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send text input" });
  }
});

app.post("/android/input/keyevent", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const rawKey = String(req.body?.key || "").trim().toUpperCase();
  if (!serial || !rawKey || !INPUT_KEY_MAP[rawKey]) {
    res.status(400).json({ error: "serial and supported key are required. key: BACK|HOME|RECENTS|ENTER|DELETE|TAB|ESCAPE|POWER" });
    return;
  }

  try {
    await adbService.keyevent(serial, INPUT_KEY_MAP[rawKey]);
    res.json({ ok: true, action: "keyevent", key: rawKey });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send keyevent input" });
  }
});

const screenshotNowHandler: express.Handler = async (req, res) => {
  const serial = String(req.params.serial || req.body?.serial || req.query?.serial || "").trim();
  if (!serial) {
    res.status(400).json({ error: "serial is required" });
    return;
  }
  try {
    const png = await adbService.screencapPng(serial);
    const wantsJson = String(req.query?.format || "").toLowerCase() === "base64";
    if (wantsJson) {
      res.json({ status: "ok", serial, mimeType: "image/png", imageBase64: png.toString("base64") });
      return;
    }
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(png);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to capture screenshot" });
  }
};

app.get("/android/device/:serial/screenshot-now", screenshotNowHandler);
app.post("/android/device/:serial/screenshot-now", screenshotNowHandler);

app.post("/android/app/restart", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const packageName = String(req.body?.packageName || "").trim();
  if (!serial || !packageName) {
    res.status(400).json({ error: "serial and packageName are required" });
    return;
  }

  try {
    await adbService.restartApp(serial, packageName);
    res.json({ status: "ok", serial, packageName });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to restart app" });
  }
});

app.post("/android/device/rotate", async (req, res) => {
  const serial = String(req.body?.serial || "").trim();
  const orientation = String(req.body?.orientation || "").trim().toLowerCase();
  if (!serial || (orientation !== "portrait" && orientation !== "landscape")) {
    res.status(400).json({ error: "serial and orientation are required. orientation: portrait|landscape" });
    return;
  }

  try {
    await adbService.setOrientation(serial, orientation as "portrait" | "landscape");
    res.json({ status: "ok", serial, orientation });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Rotate command not reliable on this image",
      warning: "Rotation support depends on emulator image and Android build."
    });
  }
});

app.listen(5050, () => {
  console.log("[host-agent] listening on http://localhost:5050");
});
