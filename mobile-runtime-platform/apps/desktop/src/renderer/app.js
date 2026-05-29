const PROFILE_META = {
  Android_Small_Clean_API_35: {
    label: "Fast Clean - Pixel 2 / API 35",
    hint: "Fastest smoke runtime profile."
  },
  Android_Small_GApps_API_35: {
    label: "Fast GApps - Pixel 2 / API 35 / Play Services",
    hint: "Use for Google Sign-In, Maps, Firebase, FCM, Play Services."
  },
  Android_Standard_Clean_API_35: {
    label: "Standard Clean - Pixel 7 / API 35",
    hint: "Modern Pixel 7 compatibility runtime."
  },
  Android_Standard_GApps_API_35: {
    label: "Standard GApps - Pixel 7 / API 35 / Play Services",
    hint: "Modern compatibility + Play Services dependent app runtime."
  }
};

const TIMELINE_STEPS = [
  "Upload APK",
  "Create Job",
  "Install APK",
  "Launch App",
  "Capture Artifacts",
  "Crash Detection",
  "Complete"
];

const WORKER_STEP_MAP = {
  apk_validate: "Upload APK",
  package_extract: "Create Job",
  apk_install: "Install APK",
  app_launch: "Launch App",
  process_check: "Launch App",
  screenshot_capture: "Capture Artifacts",
  logcat_capture: "Capture Artifacts",
  crash_detection: "Crash Detection"
};

let runtimeConfig = {
  hostAgentUrl: "http://localhost:5050",
  backendApiUrl: "http://localhost:4000",
  workerUrl: "http://localhost:6060",
  embedMode: "stream"
};

const state = {
  services: {
    host: "offline",
    backend: "offline",
    worker: "offline",
    sdk: "offline"
  },
  devices: [],
  selectedProfile: "Android_Small_Clean_API_35",
  selectedFile: null,
  activeJob: null,
  running: false,
  report: null,
  logcat: "",
  remoteDisplay: {
    active: false,
    serial: null,
    intervalId: null,
    frameInFlight: false,
    turbo: true,
    deviceWidth: 0,
    deviceHeight: 0,
    streamStatus: "disconnected",
    lastFrameAt: 0,
    lastSnapshotUrl: null
  },
  displayMode: "stream",
  nativeDock: {
    active: false,
    lastPayload: null,
    status: "inactive",
    lastResult: null,
    calibration: {
      x: 0,
      y: 0,
      widthDelta: 0,
      heightDelta: 0,
      targetWidth: 360,
      targetHeight: 560
    },
    fitMode: "full"
  },
  rotateTarget: "landscape"
};

const el = {
  globalStatus: document.getElementById("globalStatus"),
  currentDevice: document.getElementById("currentDevice"),
  displayModeChip: document.getElementById("displayModeChip"),
  displayModeSelect: document.getElementById("displayModeSelect"),
  displayModeBadge: document.getElementById("displayModeBadge"),
  nativeDockStateBadge: document.getElementById("nativeDockStateBadge"),
  nativeDockPanel: document.getElementById("nativeDockPanel"),
  nativeDockTarget: document.getElementById("nativeDockTarget"),
  nativeDockTargetLabel: document.getElementById("nativeDockTargetLabel"),
  nativeDockFitMode: document.getElementById("nativeDockFitMode"),
  dockEmulatorWindow: document.getElementById("dockEmulatorWindow"),
  redockEmulatorWindow: document.getElementById("redockEmulatorWindow"),
  undockEmulatorWindow: document.getElementById("undockEmulatorWindow"),
  returnToStream: document.getElementById("returnToStream"),
  nativeDockResultSummary: document.getElementById("nativeDockResultSummary"),
  dockOffsetX: document.getElementById("dockOffsetX"),
  dockOffsetY: document.getElementById("dockOffsetY"),
  dockWidthDelta: document.getElementById("dockWidthDelta"),
  dockHeightDelta: document.getElementById("dockHeightDelta"),
  dockTargetWidth: document.getElementById("dockTargetWidth"),
  dockTargetHeight: document.getElementById("dockTargetHeight"),
  applyDockCalibration: document.getElementById("applyDockCalibration"),
  resetDockCalibration: document.getElementById("resetDockCalibration"),
  centerDockTarget: document.getElementById("centerDockTarget"),
  fitFullDockTarget: document.getElementById("fitFullDockTarget"),
  currentProfile: document.getElementById("currentProfile"),
  preflightRaw: document.getElementById("preflightRaw"),
  jobRaw: document.getElementById("jobRaw"),
  statusCards: document.getElementById("statusCards"),
  runtimeProfile: document.getElementById("runtimeProfile"),
  profileHint: document.getElementById("profileHint"),
  apkFile: document.getElementById("apkFile"),
  apkSelected: document.getElementById("apkSelected"),
  runTarget: document.getElementById("runTarget"),
  uploadRun: document.getElementById("uploadRun"),
  startEmulator: document.getElementById("startEmulator"),
  stopEmulator: document.getElementById("stopEmulator"),
  stopEmulatorToolbar: document.getElementById("stopEmulatorToolbar"),
  refresh: document.getElementById("refresh"),
  refreshDevices: document.getElementById("refreshDevices"),
  refreshPreview: document.getElementById("refreshPreview"),
  capturePreview: document.getElementById("capturePreview"),
  preview: document.getElementById("preview"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  overlayDevice: document.getElementById("overlayDevice"),
  overlayStream: document.getElementById("overlayStream"),
  overlayInputActive: document.getElementById("overlayInputActive"),
  overlayDisplayMode: document.getElementById("overlayDisplayMode"),
  overlayBoot: document.getElementById("overlayBoot"),
  overlayProfile: document.getElementById("overlayProfile"),
  selectedProfile: document.getElementById("selectedProfile"),
  resultSummary: document.getElementById("resultSummary"),
  timeline: document.getElementById("timeline"),
  logcatView: document.getElementById("logcatView"),
  reportView: document.getElementById("reportView"),
  artifactActions: document.getElementById("artifactActions"),
  serviceConfig: document.getElementById("serviceConfig"),
  toast: document.getElementById("toast"),
  navBack: document.getElementById("navBack"),
  navHome: document.getElementById("navHome"),
  navRecents: document.getElementById("navRecents"),
  navEnter: document.getElementById("navEnter"),
  navDelete: document.getElementById("navDelete"),
  navPower: document.getElementById("navPower"),
  deviceTextInput: document.getElementById("deviceTextInput"),
  sendDeviceText: document.getElementById("sendDeviceText"),
  reconnectStream: document.getElementById("reconnectStream"),
  restartApp: document.getElementById("restartApp"),
  rotateView: document.getElementById("rotateView")
};

const emulatorFrame = document.querySelector(".emulator-frame");
let dockDebounceTimer = null;
const gestureState = {
  down: false,
  startX: 0,
  startY: 0,
  startTs: 0,
  pointerId: null,
  moved: false,
  lastX: 0,
  lastY: 0
};

function showToast(message, level = "warn") {
  el.toast.classList.remove("hidden");
  el.toast.textContent = `[${level.toUpperCase()}] ${message}`;
  el.toast.style.borderLeftColor = level === "error" ? "#ff5d73" : level === "ok" ? "#27c381" : "#ffbc42";
  setTimeout(() => el.toast.classList.add("hidden"), 3200);
}

function loadDockCalibration() {
  state.nativeDock.calibration.x = Number(localStorage.getItem("nativeDockOffsetX") || 0) || 0;
  state.nativeDock.calibration.y = Number(localStorage.getItem("nativeDockOffsetY") || 0) || 0;
  state.nativeDock.calibration.widthDelta = Number(localStorage.getItem("nativeDockWidthDelta") || 0) || 0;
  state.nativeDock.calibration.heightDelta = Number(localStorage.getItem("nativeDockHeightDelta") || 0) || 0;
  state.nativeDock.calibration.targetWidth = Number(localStorage.getItem("nativeDockTargetWidth") || 360) || 360;
  state.nativeDock.calibration.targetHeight = Number(localStorage.getItem("nativeDockTargetHeight") || 560) || 560;
  state.nativeDock.fitMode = localStorage.getItem("nativeDockFitMode") || "full";
}

function renderDockCalibration() {
  if (el.dockOffsetX) el.dockOffsetX.value = String(state.nativeDock.calibration.x);
  if (el.dockOffsetY) el.dockOffsetY.value = String(state.nativeDock.calibration.y);
  if (el.dockWidthDelta) el.dockWidthDelta.value = String(state.nativeDock.calibration.widthDelta);
  if (el.dockHeightDelta) el.dockHeightDelta.value = String(state.nativeDock.calibration.heightDelta);
  if (el.dockTargetWidth) el.dockTargetWidth.value = String(state.nativeDock.calibration.targetWidth);
  if (el.dockTargetHeight) el.dockTargetHeight.value = String(state.nativeDock.calibration.targetHeight);
  if (el.nativeDockFitMode) el.nativeDockFitMode.value = state.nativeDock.fitMode;
}

function applyDockTargetSize() {
  if (!el.nativeDockTarget) return;
  let width = state.nativeDock.calibration.targetWidth;
  let height = state.nativeDock.calibration.targetHeight;
  if (state.nativeDock.fitMode === "full") {
    width = 360;
    height = 560;
  } else if (state.nativeDock.fitMode === "compact") {
    width = 320;
    height = 520;
  }
  state.nativeDock.calibration.targetWidth = width;
  state.nativeDock.calibration.targetHeight = height;
  el.nativeDockTarget.style.width = `${Math.max(200, width)}px`;
  el.nativeDockTarget.style.height = `${Math.max(300, height)}px`;
}

function setNativeDockStatus(status) {
  state.nativeDock.status = status;
  if (!el.nativeDockStateBadge) return;
  let text = "Stream Stable";
  if (status === "docking") text = "Docking...";
  if (status === "docked") text = "Native Dock Active";
  if (status === "failed") text = "Dock Failed";
  if (status === "returned-to-stream") text = "Returned to Stream";
  el.nativeDockStateBadge.textContent = text;
}

function renderNativeDockResult() {
  if (!el.nativeDockResultSummary) return;
  const r = state.nativeDock.lastResult;
  if (!r) {
    el.nativeDockResultSummary.textContent = "Last dock result: none";
    return;
  }
  const title = r.windowTitle || "unknown";
  const proc = r.processName || "unknown";
  const b = r.bounds ? `(${r.bounds.x},${r.bounds.y},${r.bounds.width}x${r.bounds.height})` : "";
  el.nativeDockResultSummary.textContent = `Last dock result: ${title} [${proc}] ${b}`.trim();
}

function renderDisplayMode() {
  const docked = state.displayMode === "native-dock" && state.nativeDock.active;
  const modeLabel = state.displayMode === "native-dock" ? "Native Window Dock - Experimental" : "Embedded Stream - Stable";
  if (el.displayModeChip) {
    el.displayModeChip.textContent = `Display: ${modeLabel}`;
    el.displayModeChip.classList.remove("mode-embedded", "mode-streaming");
    el.displayModeChip.classList.add(state.displayMode === "native-dock" ? "mode-embedded" : "mode-streaming");
  }
  if (el.displayModeBadge) el.displayModeBadge.textContent = docked ? "Native Dock Active" : "Embedded Stream / Stable";
  if (el.nativeDockPanel) el.nativeDockPanel.classList.toggle("hidden", state.displayMode !== "native-dock");
  if (el.nativeDockTarget) el.nativeDockTarget.classList.toggle("hidden", state.displayMode !== "native-dock");
  if (el.preview) el.preview.classList.toggle("hidden", state.displayMode === "native-dock");
  if (el.previewPlaceholder) el.previewPlaceholder.classList.toggle("hidden", state.displayMode === "native-dock");
  if (el.nativeDockTargetLabel) el.nativeDockTargetLabel.classList.toggle("hidden", docked);
  document.body.classList.toggle("native-dock-active", state.displayMode === "native-dock");
  applyDockTargetSize();
  if (el.overlayDisplayMode) {
    el.overlayDisplayMode.textContent = `display: ${modeLabel.toLowerCase()}`;
  }
  renderNativeDockResult();
}

function setGlobalStatus(status) {
  el.globalStatus.className = `badge ${status}`;
  el.globalStatus.textContent = status.toUpperCase();
}

function setStreamStatus(status) {
  state.remoteDisplay.streamStatus = status;
  if (!el.overlayStream) return;
  const label = status === "connected" ? "Connected" : status === "reconnecting" ? "Reconnecting" : "Disconnected";
  el.overlayStream.textContent = label;
  el.overlayStream.className = `stream-badge ${status}`;
  el.reconnectStream?.classList.toggle("hidden", status !== "disconnected");
}

function setInputActive(active) {
  if (el.overlayInputActive) {
    el.overlayInputActive.textContent = active ? "Input Active" : "Input Inactive";
    el.overlayInputActive.className = `stream-badge ${active ? "connected" : "disconnected"}`;
  }
  if (el.preview) {
    el.preview.classList.toggle("input-active", active);
  }
}

async function getJson(url, options) {
  if (window.desktopBridge?.httpRequest) {
    const resp = await window.desktopBridge.httpRequest({
      url,
      method: options?.method || "GET",
      headers: options?.headers || {},
      body: options?.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : undefined,
      expect: "json"
    });
    if (!resp.ok) {
      const err = resp.data?.error || JSON.stringify(resp.data);
      throw new Error(`${url}: ${err}`);
    }
    return resp.data;
  }

  const res = await fetch(url, options);
  let body;
  try {
    body = await res.json();
  } catch {
    body = { error: `Non-JSON response from ${url}` };
  }
  if (!res.ok) throw new Error(`${url}: ${body.error || JSON.stringify(body)}`);
  return body;
}

async function getText(url) {
  if (window.desktopBridge?.httpRequest) {
    const resp = await window.desktopBridge.httpRequest({ url, method: "GET", expect: "text" });
    if (!resp.ok) throw new Error(`Unable to load text: ${resp.status}`);
    return resp.data;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Unable to load text: ${res.status}`);
  return res.text();
}

async function uploadApkToBackend(file) {
  const uploadForm = new FormData();
  uploadForm.append("apk", file);
  const uploadRes = await fetch(`${runtimeConfig.backendApiUrl}/apps/upload`, { method: "POST", body: uploadForm });
  const uploadBody = await uploadRes.json();
  if (!uploadRes.ok) throw new Error(uploadBody.error || "APK upload failed");
  return uploadBody;
}

function renderStatusCards() {
  const primaryDevice = state.devices.find((d) => d.state === "device");
  const cards = [
    { title: "Host Agent", value: `${state.services.host.toUpperCase()} • localhost:5050` },
    { title: "Backend API", value: `${state.services.backend.toUpperCase()} • localhost:4000` },
    { title: "Android Worker", value: `${state.services.worker.toUpperCase()} • localhost:6060` },
    { title: "Android SDK", value: state.services.sdk === "ok" ? "READY" : "NOT READY" },
    { title: "Emulator Device", value: primaryDevice ? `${primaryDevice.serial} • bootCompleted=${primaryDevice.bootCompleted}` : "No device" }
  ];

  el.statusCards.innerHTML = cards
    .map((c) => `<div class="status-card"><div class="title">${c.title}</div><div class="value">${c.value}</div></div>`)
    .join("");
}

function renderProfiles(profiles = []) {
  const current = state.selectedProfile;
  el.runtimeProfile.innerHTML = "";
  profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = PROFILE_META[p]?.label || p;
    el.runtimeProfile.appendChild(opt);
  });
  if (profiles.includes(current)) el.runtimeProfile.value = current;
  state.selectedProfile = el.runtimeProfile.value || profiles[0] || "Android_Small_Clean_API_35";

  if (el.selectedProfile) {
    el.selectedProfile.textContent = `Selected: ${PROFILE_META[state.selectedProfile]?.label || state.selectedProfile}`;
  }
  el.currentProfile.textContent = `Profile: ${state.selectedProfile}`;
  el.profileHint.textContent = PROFILE_META[state.selectedProfile]?.hint || "";
}

function renderControls() {
  const device = state.devices.find((d) => d.state === "device") || state.devices.find((d) => d.serial?.startsWith("emulator-"));
  const booted = !!device?.bootCompleted && device?.state === "device";
  const isOffline = !!device && device.state !== "device";

  el.currentDevice.textContent = `Device: ${device ? `${device.serial}${isOffline ? " (offline)" : ""}` : "none"}`;
  el.overlayDevice.textContent = `serial: ${device ? device.serial : "none"}`;
  el.overlayBoot.textContent = `boot: ${booted ? "true" : "false"}${isOffline ? " (offline)" : ""}`;
  el.overlayProfile.textContent = `profile: ${state.selectedProfile}`;

  const preflightReady = [state.services.host, state.services.backend, state.services.worker].every((s) => s === "ok");
  const canRun = preflightReady && booted && !!state.selectedFile && !state.running;

  const canForwardInput = state.services.host === "ok" && booted && !isOffline && state.remoteDisplay.streamStatus === "connected";
  el.startEmulator.disabled = state.services.host !== "ok";
  el.stopEmulator.disabled = state.services.host !== "ok" || !device;
  el.stopEmulatorToolbar.disabled = state.services.host !== "ok" || !device;
  el.uploadRun.disabled = !canRun;
  el.navBack.disabled = !canForwardInput;
  el.navHome.disabled = !canForwardInput;
  el.navRecents.disabled = !canForwardInput;
  el.navEnter.disabled = !canForwardInput;
  el.navDelete.disabled = !canForwardInput;
  el.navPower.disabled = !canForwardInput;
  el.sendDeviceText.disabled = !canForwardInput;
  el.deviceTextInput.disabled = !canForwardInput;
  el.capturePreview.disabled = state.services.host !== "ok" || !device || !booted;
  el.rotateView.disabled = !canForwardInput;
  el.restartApp.disabled = !canForwardInput || !state.report?.app?.packageName;
  el.uploadRun.textContent = state.running ? "Running..." : "Upload & Run";

  el.runTarget.textContent = `Target: ${device ? `${device.serial}${isOffline ? " (offline)" : ""}` : "no device"} | ${state.selectedProfile}`;
  el.startEmulator.textContent = device ? (booted ? "Emulator Running" : "Emulator Detected") : "Start Emulator";

  if (!state.running && preflightReady) {
    setGlobalStatus(device ? "ready" : "offline");
  }
}

function setPreview(url) {
  if (url) {
    el.preview.style.display = "block";
    el.previewPlaceholder.style.display = "none";
    el.preview.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
    state.remoteDisplay.lastSnapshotUrl = el.preview.src;
  } else {
    el.preview.style.display = "none";
    el.previewPlaceholder.style.display = "block";
  }
}

function applyDisplayLayout(width, height) {
  if (!emulatorFrame || !width || !height) return;
  const isLandscape = width >= height;
  emulatorFrame.classList.toggle("landscape", isLandscape);
  emulatorFrame.classList.toggle("portrait", !isLandscape);
  emulatorFrame.style.setProperty("--emu-ar", `${width} / ${height}`);
}

function getEmulatorDockRect() {
  const rect = el.nativeDockTarget?.getBoundingClientRect();
  if (!rect) return null;
  const serial = getActiveSerial();
  return {
    serial,
    avdName: state.selectedProfile || null,
    displayMode: state.displayMode,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      devicePixelRatio: window.devicePixelRatio || 1,
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0
    },
    offsets: {
      x: state.nativeDock.calibration.x,
      y: state.nativeDock.calibration.y,
      widthDelta: state.nativeDock.calibration.widthDelta,
      heightDelta: state.nativeDock.calibration.heightDelta
    }
  };
}

function setDisplayMode(mode) {
  state.displayMode = mode;
  void window.runtimeDock?.setDockMode?.(mode);
  if (mode === "stream" && state.nativeDock.status === "inactive") setNativeDockStatus("inactive");
  if (el.displayModeSelect && el.displayModeSelect.value !== mode) el.displayModeSelect.value = mode;
  renderDisplayMode();
}

function scheduleDockSync(reason = "redock") {
  if (state.displayMode !== "native-dock") return;
  if (dockDebounceTimer) clearTimeout(dockDebounceTimer);
  dockDebounceTimer = setTimeout(() => {
    void dockEmulatorWindow(reason);
  }, 120);
}

async function dockEmulatorWindow(reason = "dock") {
  if (!window.runtimeDock?.dockEmulatorWindow) {
    showToast("Native dock bridge unavailable.", "error");
    return;
  }
  const payload = getEmulatorDockRect();
  if (!payload) {
    showToast("Dock target area not available.", "error");
    return;
  }
  if (payload.rect.width < 200 || payload.rect.height < 300) {
    showToast("Dock target too small for emulator window.", "warn");
    return;
  }
  try {
    setNativeDockStatus("docking");
    const result = await window.runtimeDock.dockEmulatorWindow(payload);
    state.nativeDock.lastResult = result;
    if (!result?.ok) {
      state.nativeDock.active = false;
      setNativeDockStatus("failed");
      renderDisplayMode();
      if (String(result?.reason || "") === "emulator_window_not_found") {
        showToast("No visible emulator window found. Start emulator in windowed mode, not -no-window.", "warn");
      } else if (String(result?.reason || "") === "windows_dock_helper_failed") {
        showToast("Native Dock helper failed. Stream mode is still available.", "warn");
      } else {
        showToast("Native Dock failed. Returning to Embedded Stream.", "warn");
      }
      await returnToStreamFallback();
      return;
    }
    state.nativeDock.active = true;
    state.nativeDock.lastPayload = payload;
    setNativeDockStatus("docked");
    renderDisplayMode();
    if (reason === "dock") showToast("Native Dock active.", "ok");
  } catch (error) {
    state.nativeDock.active = false;
    setNativeDockStatus("failed");
    showToast("Native Dock failed. Returning to Embedded Stream.", "error");
    await returnToStreamFallback();
  }
}

async function undockEmulatorWindow() {
  const payload = getEmulatorDockRect() || { serial: getActiveSerial(), avdName: state.selectedProfile || null };
  try {
    await window.runtimeDock?.undockEmulatorWindow(payload);
  } catch {
    // best effort
  }
  state.nativeDock.active = false;
  setNativeDockStatus("inactive");
  renderDisplayMode();
}

async function returnToStreamFallback() {
  setDisplayMode("stream");
  setNativeDockStatus("returned-to-stream");
  const serial = getActiveSerial();
  if (serial) await startLivePreview(serial);
}

async function refreshLiveFrame() {
  if (!state.remoteDisplay.active || !state.remoteDisplay.serial) return;
  if (gestureState.down) return;
  if (state.remoteDisplay.frameInFlight) return;
  state.remoteDisplay.frameInFlight = true;
  const url = `${runtimeConfig.hostAgentUrl}/android/display/frame?serial=${encodeURIComponent(state.remoteDisplay.serial)}`;
  setPreview(url);
}

function scheduleLiveFrameLoop() {
  if (!state.remoteDisplay.active) return;
  const intervalMs = state.remoteDisplay.turbo ? (state.running ? 120 : 160) : (state.running ? 220 : 500);
  state.remoteDisplay.intervalId = setTimeout(async () => {
    try {
      await refreshLiveFrame();
    } finally {
      scheduleLiveFrameLoop();
    }
  }, intervalMs);
}

async function loadDisplayMetrics(serial) {
  try {
    const m = await getJson(`${runtimeConfig.hostAgentUrl}/android/display/metrics?serial=${encodeURIComponent(serial)}`);
    state.remoteDisplay.deviceWidth = Number(m.width) || 0;
    state.remoteDisplay.deviceHeight = Number(m.height) || 0;
    applyDisplayLayout(state.remoteDisplay.deviceWidth, state.remoteDisplay.deviceHeight);
  } catch {
    state.remoteDisplay.deviceWidth = 0;
    state.remoteDisplay.deviceHeight = 0;
  }
}

function stopLivePreview() {
  if (state.remoteDisplay.intervalId) clearTimeout(state.remoteDisplay.intervalId);
  state.remoteDisplay.intervalId = null;
  state.remoteDisplay.frameInFlight = false;
  state.remoteDisplay.active = false;
  state.remoteDisplay.serial = null;
  setStreamStatus("disconnected");
}

async function startLivePreview(serial) {
  if (!serial) return;
  if (state.remoteDisplay.active && state.remoteDisplay.serial === serial) return;

  stopLivePreview();
  state.remoteDisplay.active = true;
  state.remoteDisplay.serial = serial;
  setStreamStatus("reconnecting");
  await loadDisplayMetrics(serial);
  await refreshLiveFrame();
  scheduleLiveFrameLoop();
}

function previewToDevicePoint(clientX, clientY) {
  const img = el.preview;
  const rect = img.getBoundingClientRect();
  const nw = img.naturalWidth || state.remoteDisplay.deviceWidth || 1080;
  const nh = img.naturalHeight || state.remoteDisplay.deviceHeight || 1920;
  if (!nw || !nh) return null;

  const scale = Math.min(rect.width / nw, rect.height / nh);
  const drawW = nw * scale;
  const drawH = nh * scale;
  const offsetX = (rect.width - drawW) / 2;
  const offsetY = (rect.height - drawH) / 2;

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  if (localX < offsetX || localY < offsetY || localX > offsetX + drawW || localY > offsetY + drawH) return null;

  return {
    x: Math.round(((localX - offsetX) / drawW) * nw),
    y: Math.round(((localY - offsetY) / drawH) * nh)
  };
}

async function sendSwipe(serial, x1, y1, x2, y2, durationMs = 220) {
  await getJson(`${runtimeConfig.hostAgentUrl}/android/input/swipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial, x1, y1, x2, y2, durationMs })
  });
}

async function sendKeyevent(serial, key) {
  await getJson(`${runtimeConfig.hostAgentUrl}/android/input/keyevent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial, key })
  });
}

async function sendTextInput(serial, text) {
  await getJson(`${runtimeConfig.hostAgentUrl}/android/input/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serial, text })
  });
}

function getActiveSerial() {
  return state.remoteDisplay.serial || state.devices.find((d) => d.state === "device")?.serial || null;
}

async function runNavAction(fn) {
  const serial = getActiveSerial();
  if (!serial) {
    showToast("No active emulator device", "warn");
    return;
  }
  try {
    await fn(serial);
    await refreshLiveFrame();
  } catch (e) {
    showToast(e.message || String(e), "error");
  }
}

function renderTimeline(job, report) {
  const stepState = Object.fromEntries(TIMELINE_STEPS.map((s) => [s, "pending"]));

  if (job) {
    stepState["Upload APK"] = "passed";
    stepState["Create Job"] = ["queued", "running", "passed", "failed", "blocked"].includes(job.status) ? "passed" : "pending";
    if (job.status === "running") stepState["Install APK"] = "active";
    if (["passed", "failed", "blocked"].includes(job.status)) stepState["Complete"] = job.status === "passed" ? "passed" : job.status;
  }

  if (report?.steps) {
    report.steps.forEach((s) => {
      const mapped = WORKER_STEP_MAP[s.name];
      if (!mapped) return;
      const curr = stepState[mapped];
      if (curr === "failed") return;
      stepState[mapped] = s.status === "passed" ? "passed" : s.status === "failed" ? "failed" : "blocked";
    });
    stepState["Complete"] = report.status;
  }

  el.timeline.innerHTML = TIMELINE_STEPS.map((name) => {
    const st = stepState[name] || "pending";
    return `<div class="timeline-step ${st}"><span>${name}</span><span class="state">${st}</span></div>`;
  }).join("");
}

function renderResultSummary(job, report) {
  if (!job) {
    el.resultSummary.classList.add("hidden");
    return;
  }

  const status = report?.status || job.status || "running";
  const reason = report?.reason || job.reason || "-";
  const pkg = report?.app?.packageName || "unknown";

  el.resultSummary.classList.remove("hidden");
  el.resultSummary.innerHTML = `
    <h4><span class="badge ${status}">${status.toUpperCase()}</span> Runtime Result</h4>
    <div class="grid">
      <div>Job ID: ${job.id || job.jobId || "-"}</div>
      <div>Runtime Profile: ${job.runtimeProfile || state.selectedProfile}</div>
      <div>Device: ${job.deviceSerial || report?.device?.serial || "-"}</div>
      <div>Package: ${pkg}</div>
      <div>Started: ${report?.startedAt || job.createdAt || "-"}</div>
      <div>Finished: ${report?.finishedAt || "-"}</div>
      <div style="grid-column: 1 / -1;">Reason: ${reason}</div>
    </div>
  `;
}

function renderArtifacts(jobId) {
  if (!jobId) {
    el.artifactActions.innerHTML = "No artifacts yet.";
    return;
  }
  const reportUrl = `${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/report.json`;
  const screenshotUrl = `${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/screenshots/launch.png`;
  const logcatUrl = `${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/logs/logcat.txt`;

  el.artifactActions.innerHTML = `
    <button class="btn btn-primary" data-open="${reportUrl}">Open Report</button>
    <button class="btn btn-primary" data-open="${screenshotUrl}">Open Screenshot</button>
    <button class="btn btn-primary" data-open="${logcatUrl}">Open Logcat</button>
    <button class="btn btn-ghost" id="openArtifactFolderBtn">Open Artifacts Folder</button>
    <button class="btn btn-ghost" id="copyJobIdBtn">Copy Job ID</button>
    <button class="btn btn-ghost" id="copyArtifactUrlsBtn">Copy Artifact URLs</button>
  `;

  Array.from(el.artifactActions.querySelectorAll("[data-open]")).forEach((btn) => {
    btn.addEventListener("click", () => window.open(btn.dataset.open, "_blank"));
  });

  document.getElementById("openArtifactFolderBtn")?.addEventListener("click", async () => {
    const r = await window.desktopBridge.openArtifactsFolder();
    if (r !== "ok") showToast(r, "error");
  });

  document.getElementById("copyJobIdBtn")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(jobId);
    showToast("Job ID copied", "ok");
  });

  document.getElementById("copyArtifactUrlsBtn")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText([reportUrl, screenshotUrl, logcatUrl].join("\n"));
    showToast("Artifact URLs copied", "ok");
  });
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
  document.querySelectorAll(".tab-body").forEach((x) => x.classList.toggle("active", x.id === `tab-${tab}`));
}

async function refreshStatus() {
  const debug = {};
  try {
    const host = await getJson(`${runtimeConfig.hostAgentUrl}/health`);
    state.services.host = host.status === "ok" ? "ok" : "offline";
    debug.host = host;
  } catch (e) {
    state.services.host = "offline";
    showToast(`Host Agent offline: ${e.message}`, "error");
  }

  try {
    const backend = await getJson(`${runtimeConfig.backendApiUrl}/health`);
    state.services.backend = backend.status === "ok" ? "ok" : "offline";
    debug.backend = backend;
  } catch (e) {
    state.services.backend = "offline";
    showToast(`Backend offline: ${e.message}`, "error");
  }

  try {
    const worker = await getJson(`${runtimeConfig.workerUrl}/health`);
    state.services.worker = worker.status === "ok" ? "ok" : "offline";
    debug.worker = worker;
  } catch (e) {
    state.services.worker = "offline";
    showToast(`Worker offline: ${e.message}`, "error");
  }

  if (state.services.host === "ok") {
    try {
      const [sdk, avds, devices] = await Promise.all([
        getJson(`${runtimeConfig.hostAgentUrl}/android/sdk/status`),
        getJson(`${runtimeConfig.hostAgentUrl}/android/avds`),
        getJson(`${runtimeConfig.hostAgentUrl}/android/devices`)
      ]);
      state.services.sdk = sdk.ready ? "ok" : "warn";
      state.devices = devices.devices || [];
      renderProfiles(avds.avds || []);
      debug.sdk = sdk;
      debug.avds = avds;
      debug.devices = devices;
    } catch (e) {
      state.services.sdk = "warn";
      state.devices = [];
      showToast(`Host runtime details unavailable: ${e.message}`, "error");
    }
  }

  renderStatusCards();
  renderControls();
  el.preflightRaw.textContent = JSON.stringify(debug, null, 2);

  const device = state.devices.find((d) => d.state === "device");
  if (!device?.bootCompleted) {
    stopLivePreview();
    if (state.displayMode !== "native-dock") setPreview(null);
    return;
  }

  if (state.displayMode === "stream") {
    await startLivePreview(device.serial);
  } else if (state.displayMode === "native-dock" && state.nativeDock.active) {
    scheduleDockSync("status-refresh");
  }
}

async function waitForBootAndPreview(maxAttempts = 80, delayMs = 1500) {
  for (let i = 0; i < maxAttempts; i += 1) {
    await refreshStatus();
    const device = state.devices.find((d) => d.state === "device");
    if (device?.bootCompleted) {
      await startLivePreview(device.serial);
      return true;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function startEmulator() {
  try {
    const result = await getJson(`${runtimeConfig.hostAgentUrl}/android/emulator/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avdName: state.selectedProfile })
    });

    if (result.status === "already_running") {
      showToast(`Emulator already running (${result.serial})`, "ok");
    } else {
      showToast(`Starting emulator ${result.avdName}`, "ok");
    }

    const started = await waitForBootAndPreview();
    if (!started) {
      showToast("Emulator boot is taking longer than expected. Click Refresh in a few seconds.", "warn");
      return;
    }

    if (state.displayMode === "native-dock") {
      await dockEmulatorWindow("dock");
    }
  } catch (e) {
    showToast(`Start emulator failed: ${e.message}`, "error");
  }
}

async function stopEmulator() {
  try {
    if (state.displayMode === "native-dock") {
      await undockEmulatorWindow();
    }
    stopLivePreview();
    const result = await getJson(`${runtimeConfig.hostAgentUrl}/android/emulator/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    showToast(`Stop emulator: ${result.status}`, "ok");
    await refreshStatus();
  } catch (e) {
    showToast(`Stop emulator failed: ${e.message}`, "error");
  }
}

async function loadReportAndLogcat(jobId) {
  const reportUrl = `${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/report.json`;
  const logcatUrl = `${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/logs/logcat.txt`;

  try {
    state.report = await getJson(reportUrl);
    el.reportView.textContent = JSON.stringify(state.report, null, 2);
    renderResultSummary(state.activeJob, state.report);
    renderTimeline(state.activeJob, state.report);
  } catch (e) {
    el.reportView.textContent = `[ERROR] ${e.message}`;
  }

  try {
    state.logcat = await getText(logcatUrl);
    el.logcatView.textContent = state.logcat;
  } catch (e) {
    el.logcatView.textContent = `[ERROR] ${e.message}`;
  }
}

async function pollJob(jobId) {
  while (true) {
    const job = await getJson(`${runtimeConfig.backendApiUrl}/runtime/jobs/${jobId}`);
    state.activeJob = job;
    el.jobRaw.textContent = JSON.stringify(job, null, 2);
    renderTimeline(job, state.report);
    renderResultSummary(job, state.report);
    renderArtifacts(job.id || job.jobId);

    if (["passed", "failed", "blocked"].includes(job.status)) {
      setGlobalStatus(job.status);
      await loadReportAndLogcat(job.id || job.jobId);
      if (!state.remoteDisplay.active) {
        setPreview(`${runtimeConfig.backendApiUrl}/artifacts/jobs/${job.id || job.jobId}/screenshots/launch.png`);
      }
      state.running = false;
      renderControls();
      return job;
    }

    state.running = true;
    setGlobalStatus("running");
    renderControls();
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function uploadAndRun() {
  try {
    const file = state.selectedFile;
    if (!file) throw new Error("No APK selected");

    const device = state.devices.find((d) => d.state === "device");
    if (!device) throw new Error("No emulator device found");
    if (!device.bootCompleted) throw new Error("Device bootCompleted is false");

    state.running = true;
    renderControls();
    renderTimeline({ status: "queued" }, null);

    const uploadBody = await uploadApkToBackend(file);

    const runRes = await getJson(`${runtimeConfig.backendApiUrl}/runtime/android/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apkPath: uploadBody.apkPath,
        deviceSerial: device.serial,
        runtimeProfile: state.selectedProfile
      })
    });

    showToast(`Job created: ${runRes.jobId}`, "ok");
    await pollJob(runRes.jobId);
  } catch (e) {
    state.running = false;
    renderControls();
    showToast(e.message || String(e), "error");
  }
}

async function init() {
  const bridge = window.desktopBridge;
  if (!bridge?.getRuntimeConfig) {
    showToast("Desktop bridge not available. Using localhost defaults.", "warn");
  } else {
    try {
      const cfg = await bridge.getRuntimeConfig();
      if (cfg?.hostAgentUrl && cfg?.backendApiUrl && cfg?.workerUrl) {
        runtimeConfig = { ...runtimeConfig, ...cfg };
      } else {
        showToast("Invalid bridge config. Using localhost defaults.", "warn");
      }
    } catch (error) {
      showToast(`Bridge config failed: ${error?.message || error}. Using localhost defaults.`, "warn");
    }
  }

  if (el.serviceConfig) {
    el.serviceConfig.textContent = `HOST_AGENT_URL=${runtimeConfig.hostAgentUrl} | BACKEND_API_URL=${runtimeConfig.backendApiUrl} | WORKER_URL=${runtimeConfig.workerUrl}`;
  }

  loadDockCalibration();
  renderDockCalibration();

  el.runtimeProfile.addEventListener("change", () => {
    state.selectedProfile = el.runtimeProfile.value;
    renderProfiles(Array.from(el.runtimeProfile.options).map((o) => o.value));
    renderControls();
  });

  el.apkFile.addEventListener("change", () => {
    state.selectedFile = el.apkFile.files?.[0] || null;
    el.apkSelected.textContent = state.selectedFile ? `Selected APK: ${state.selectedFile.name}` : "Selected APK: none";
    renderControls();
  });

  el.preview.addEventListener("pointerdown", (event) => {
    if (!state.remoteDisplay.active || state.remoteDisplay.streamStatus !== "connected") return;
    event.preventDefault();
    el.preview.focus();
    const p = previewToDevicePoint(event.clientX, event.clientY);
    if (!p) return;
    try {
      el.preview.setPointerCapture(event.pointerId);
    } catch {
      // ignore capture errors
    }
    gestureState.down = true;
    gestureState.startX = p.x;
    gestureState.startY = p.y;
    gestureState.startTs = Date.now();
    gestureState.pointerId = event.pointerId;
    gestureState.moved = false;
    gestureState.lastX = p.x;
    gestureState.lastY = p.y;
  });

  el.preview.addEventListener("pointermove", (event) => {
    if (!gestureState.down) return;
    if (gestureState.pointerId !== null && event.pointerId !== gestureState.pointerId) return;
    event.preventDefault();
    const p = previewToDevicePoint(event.clientX, event.clientY);
    if (!p) return;
    gestureState.lastX = p.x;
    gestureState.lastY = p.y;
    const dx = p.x - gestureState.startX;
    const dy = p.y - gestureState.startY;
    if (Math.sqrt(dx * dx + dy * dy) > 12) {
      gestureState.moved = true;
    }
  });

  el.preview.addEventListener("pointerup", (event) => {
    if (!state.remoteDisplay.active || state.remoteDisplay.streamStatus !== "connected" || !gestureState.down || !state.remoteDisplay.serial) return;
    if (gestureState.pointerId !== null && event.pointerId !== gestureState.pointerId) return;
    event.preventDefault();
    try {
      el.preview.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors
    }
    gestureState.down = false;
    gestureState.pointerId = null;
    const end = previewToDevicePoint(event.clientX, event.clientY) || { x: gestureState.lastX, y: gestureState.lastY };
    if (!end) return;

    const dx = end.x - gestureState.startX;
    const dy = end.y - gestureState.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(80, Math.min(700, Date.now() - gestureState.startTs));
    const upward = dy < 0;
    const largeUpward = upward && Math.abs(dy) > 220;
    const fromBottom = gestureState.startY > (state.remoteDisplay.deviceHeight * 0.78);
    const holdLike = duration >= 260;

    if (dist < 24 && !gestureState.moved) {
      void getJson(`${runtimeConfig.hostAgentUrl}/android/input/tap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial: state.remoteDisplay.serial, x: end.x, y: end.y })
      }).finally(() => {
        showToast("Tap sent", "ok");
        void refreshLiveFrame();
      });
      return;
    }

    // Reliable fallback for recent-apps (background app check) gesture.
    if (fromBottom && largeUpward && holdLike) {
      void sendKeyevent(state.remoteDisplay.serial, "RECENTS").finally(() => {
        void refreshLiveFrame();
      });
      return;
    }

    void sendSwipe(state.remoteDisplay.serial, gestureState.startX, gestureState.startY, end.x, end.y, duration).finally(() => {
      showToast("Swipe sent", "ok");
      void refreshLiveFrame();
    });
  });

  el.preview.addEventListener("pointercancel", () => {
    if (!gestureState.down) return;
    gestureState.down = false;
    gestureState.pointerId = null;
    gestureState.moved = false;
    void refreshLiveFrame();
  });

  el.preview.addEventListener("load", () => {
    state.remoteDisplay.frameInFlight = false;
    state.remoteDisplay.lastFrameAt = Date.now();
    setStreamStatus("connected");
    const w = el.preview.naturalWidth;
    const h = el.preview.naturalHeight;
    if (w && h) applyDisplayLayout(w, h);
  });
  el.preview.addEventListener("error", () => {
    state.remoteDisplay.frameInFlight = false;
    if (state.remoteDisplay.active) {
      setStreamStatus("reconnecting");
      setTimeout(() => {
        if (state.remoteDisplay.streamStatus !== "connected") {
          setStreamStatus("disconnected");
          if (state.remoteDisplay.lastSnapshotUrl) {
            el.preview.src = state.remoteDisplay.lastSnapshotUrl;
            el.preview.style.display = "block";
            el.previewPlaceholder.style.display = "none";
          } else {
            setPreview(null);
          }
        }
      }, 1800);
    }
  });

  el.reconnectStream?.addEventListener("click", async () => {
    const serial = getActiveSerial();
    if (!serial) {
      showToast("No active emulator device", "warn");
      return;
    }
    try {
      await startLivePreview(serial);
      showToast("Stream reconnect requested", "ok");
    } catch (e) {
      showToast(`Reconnect failed: ${e.message || String(e)}`, "error");
    }
  });

  el.preview.addEventListener("focus", () => setInputActive(true));
  el.preview.addEventListener("blur", () => setInputActive(false));

  document.querySelectorAll(".tab").forEach((btn) => btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab);
    scheduleDockSync("tab-change");
  }));

  el.refresh.addEventListener("click", refreshStatus);
  document.getElementById("refreshDevices")?.addEventListener("click", refreshStatus);
  el.startEmulator.addEventListener("click", startEmulator);
  el.stopEmulator.addEventListener("click", stopEmulator);
  el.stopEmulatorToolbar.addEventListener("click", stopEmulator);
  document.getElementById("uploadRun")?.addEventListener("click", uploadAndRun);
  el.displayModeSelect?.addEventListener("change", async () => {
    const nextMode = el.displayModeSelect.value === "native-dock" ? "native-dock" : "stream";
    setDisplayMode(nextMode);
    if (nextMode === "stream") {
      await undockEmulatorWindow();
      await returnToStreamFallback();
      return;
    }
    scheduleDockSync("mode-switch");
  });
  el.applyDockCalibration?.addEventListener("click", async () => {
    state.nativeDock.calibration.x = Number(el.dockOffsetX?.value || 0) || 0;
    state.nativeDock.calibration.y = Number(el.dockOffsetY?.value || 0) || 0;
    state.nativeDock.calibration.widthDelta = Number(el.dockWidthDelta?.value || 0) || 0;
    state.nativeDock.calibration.heightDelta = Number(el.dockHeightDelta?.value || 0) || 0;
    state.nativeDock.calibration.targetWidth = Number(el.dockTargetWidth?.value || 360) || 360;
    state.nativeDock.calibration.targetHeight = Number(el.dockTargetHeight?.value || 560) || 560;
    state.nativeDock.fitMode = el.nativeDockFitMode?.value || state.nativeDock.fitMode;
    localStorage.setItem("nativeDockOffsetX", String(state.nativeDock.calibration.x));
    localStorage.setItem("nativeDockOffsetY", String(state.nativeDock.calibration.y));
    localStorage.setItem("nativeDockWidthDelta", String(state.nativeDock.calibration.widthDelta));
    localStorage.setItem("nativeDockHeightDelta", String(state.nativeDock.calibration.heightDelta));
    localStorage.setItem("nativeDockTargetWidth", String(state.nativeDock.calibration.targetWidth));
    localStorage.setItem("nativeDockTargetHeight", String(state.nativeDock.calibration.targetHeight));
    localStorage.setItem("nativeDockFitMode", state.nativeDock.fitMode);
    applyDockTargetSize();
    await dockEmulatorWindow("redock");
  });
  el.resetDockCalibration?.addEventListener("click", async () => {
    state.nativeDock.calibration = { x: 0, y: 0, widthDelta: 0, heightDelta: 0, targetWidth: 360, targetHeight: 560 };
    state.nativeDock.fitMode = "full";
    localStorage.setItem("nativeDockOffsetX", "0");
    localStorage.setItem("nativeDockOffsetY", "0");
    localStorage.setItem("nativeDockWidthDelta", "0");
    localStorage.setItem("nativeDockHeightDelta", "0");
    localStorage.setItem("nativeDockTargetWidth", "360");
    localStorage.setItem("nativeDockTargetHeight", "560");
    localStorage.setItem("nativeDockFitMode", "full");
    renderDockCalibration();
    applyDockTargetSize();
    await dockEmulatorWindow("redock");
  });
  el.nativeDockFitMode?.addEventListener("change", async () => {
    state.nativeDock.fitMode = el.nativeDockFitMode.value;
    localStorage.setItem("nativeDockFitMode", state.nativeDock.fitMode);
    applyDockTargetSize();
    renderDockCalibration();
    await dockEmulatorWindow("redock");
  });
  el.centerDockTarget?.addEventListener("click", async () => {
    applyDockTargetSize();
    await dockEmulatorWindow("redock");
  });
  el.fitFullDockTarget?.addEventListener("click", async () => {
    state.nativeDock.fitMode = "full";
    localStorage.setItem("nativeDockFitMode", "full");
    applyDockTargetSize();
    renderDockCalibration();
    await dockEmulatorWindow("redock");
  });
  el.dockEmulatorWindow?.addEventListener("click", () => { void dockEmulatorWindow("dock"); });
  el.redockEmulatorWindow?.addEventListener("click", () => { void dockEmulatorWindow("redock"); });
  el.undockEmulatorWindow?.addEventListener("click", () => { void undockEmulatorWindow(); });
  el.returnToStream?.addEventListener("click", async () => {
    await undockEmulatorWindow();
    await returnToStreamFallback();
  });

  document.getElementById("refreshPreview")?.addEventListener("click", async () => {
    if (state.displayMode === "native-dock") {
      await dockEmulatorWindow("redock");
      return;
    }
    if (state.remoteDisplay.active) {
      await refreshLiveFrame();
      return;
    }

    const jobId = state.activeJob?.id || state.activeJob?.jobId;
    if (!jobId) {
      showToast("No device preview available yet", "warn");
      return;
    }
    setPreview(`${runtimeConfig.backendApiUrl}/artifacts/jobs/${jobId}/screenshots/launch.png`);
  });

  document.getElementById("capturePreview")?.addEventListener("click", async () => {
    const serial = getActiveSerial();
    if (!serial) {
      showToast("No active emulator device", "warn");
      return;
    }
    try {
      setPreview(`${runtimeConfig.hostAgentUrl}/android/device/${encodeURIComponent(serial)}/screenshot-now`);
      showToast("Screenshot captured", "ok");
    } catch (e) {
      showToast(`Screenshot failed: ${e.message || String(e)}`, "error");
    }
  });

  el.rotateView?.addEventListener("click", async () => {
    const serial = getActiveSerial();
    if (!serial) {
      showToast("No active emulator device", "warn");
      return;
    }
    try {
      const orientation = state.rotateTarget;
      await getJson(`${runtimeConfig.hostAgentUrl}/android/device/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, orientation })
      });
      state.rotateTarget = orientation === "landscape" ? "portrait" : "landscape";
      showToast(`Rotate ${orientation} sent`, "ok");
      await refreshLiveFrame();
    } catch (e) {
      showToast(`Rotate failed: ${e.message || String(e)}`, "error");
    }
  });

  el.restartApp?.addEventListener("click", async () => {
    const serial = getActiveSerial();
    const packageName = state.report?.app?.packageName;
    if (!serial || !packageName) {
      showToast("Restart requires active device and packageName from runtime report", "warn");
      return;
    }
    try {
      await getJson(`${runtimeConfig.hostAgentUrl}/android/app/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial, packageName })
      });
      showToast(`Restarted ${packageName}`, "ok");
      await refreshLiveFrame();
    } catch (e) {
      showToast(`Restart failed: ${e.message || String(e)}`, "error");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (document.activeElement !== el.preview) return;
    if (state.remoteDisplay.streamStatus !== "connected") return;
    const serial = getActiveSerial();
    if (!serial) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      void sendKeyevent(serial, "DELETE");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void sendKeyevent(serial, "ENTER");
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      void sendKeyevent(serial, "BACK");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      void sendKeyevent(serial, "TAB");
      return;
    }
    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      void sendKeyevent(serial, "BACK");
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      void sendTextInput(serial, event.key);
    }
  });

  el.navBack?.addEventListener("click", () => {
    void runNavAction((serial) => sendKeyevent(serial, "BACK"));
  });
  el.navHome?.addEventListener("click", () => {
    void runNavAction((serial) => sendKeyevent(serial, "HOME"));
  });
  el.navRecents?.addEventListener("click", () => {
    void runNavAction((serial) => sendKeyevent(serial, "RECENTS"));
  });
  el.navEnter?.addEventListener("click", () => { void runNavAction((serial) => sendKeyevent(serial, "ENTER")); });
  el.navDelete?.addEventListener("click", () => { void runNavAction((serial) => sendKeyevent(serial, "DELETE")); });
  el.navPower?.addEventListener("click", () => { void runNavAction((serial) => sendKeyevent(serial, "POWER")); });

  el.sendDeviceText?.addEventListener("click", async () => {
    const serial = getActiveSerial();
    const text = String(el.deviceTextInput?.value || "").trim();
    if (!serial) {
      showToast("No booted device connected", "warn");
      return;
    }
    if (!text) {
      showToast("Enter text to send", "warn");
      return;
    }
    try {
      await sendTextInput(serial, text);
      el.deviceTextInput.value = "";
      showToast("Text sent", "ok");
      await refreshLiveFrame();
    } catch (e) {
      showToast(`Text send failed: ${e.message || String(e)}`, "error");
    }
  });

  if (bridge?.onRuntimeRefresh) bridge.onRuntimeRefresh(() => refreshStatus());
  if (bridge?.onRuntimeError) bridge.onRuntimeError((message) => showToast(message, "error"));
  if (bridge?.onAbout) bridge.onAbout((data) => showToast(`${data.appName} v${data.version}`, "ok"));
  if (bridge?.onNativeDockAction) {
    bridge.onNativeDockAction(async ({ action }) => {
      if (action === "dock") {
        setDisplayMode("native-dock");
        await dockEmulatorWindow("dock");
      } else if (action === "undock") {
        await undockEmulatorWindow();
      } else {
        await undockEmulatorWindow();
        await returnToStreamFallback();
      }
    });
  }
  if (bridge?.onNativeDockRedockResult) {
    bridge.onNativeDockRedockResult(async (result) => {
      if (result?.ok) return;
      setNativeDockStatus("failed");
      showToast("Auto re-dock failed. Returning to Embedded Stream.", "warn");
      await returnToStreamFallback();
    });
  }

  setDisplayMode("stream");
  setNativeDockStatus("inactive");
  renderDisplayMode();
  window.addEventListener("resize", () => scheduleDockSync("window-resize"));
  window.addEventListener("scroll", () => scheduleDockSync("window-scroll"), { passive: true });
  if (window.ResizeObserver && emulatorFrame) {
    const observer = new ResizeObserver(() => scheduleDockSync("layout-resize"));
    observer.observe(emulatorFrame);
  }

  await refreshStatus();
  renderTimeline(null, null);
}

init().catch((e) => showToast(e.message || String(e), "error"));
