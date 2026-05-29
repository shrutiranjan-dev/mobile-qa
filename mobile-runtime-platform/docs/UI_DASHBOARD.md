# UI Dashboard (Android Runtime MVP)

## Purpose
The Electron desktop UI is an Android runtime cockpit for operating the host-agent + backend + worker runtime pipeline.

## Layout Overview
- Left sidebar: Runtime, Jobs, Artifacts, Reports, Settings.
- Top app bar: global status + display mode + current device/profile.
- Center hero panel: Embedded Emulator View (stream-first).
- Right control panel: service health cards, runtime profile, emulator controls, APK runner.
- Bottom panel tabs: timeline, logcat, report JSON, artifacts, advanced debug.

## Embedded Emulator View
- Display modes:
  - `Embedded Stream - Stable` (default)
  - `Native Window Dock - Experimental` (optional)
- Native dock is not true DOM embedding; it repositions the real emulator OS window over a reserved dock area.
- Native Win32 SetParent embedding remains experimental-only and is not default.
- Native Dock includes:
  - Dock/Re-dock/Undock/Return-to-Stream controls
  - state badge (`Stream Stable`, `Docking...`, `Native Dock Active`, `Dock Failed`)
  - automatic fallback to stream on docking failure
  - auto re-dock on desktop window move/resize (debounced)
  - local calibration offsets persisted in `localStorage`
  - dedicated `#nativeDockTarget` rectangle for OS-level dock placement (not whole workspace)
  - fit modes (`Full Emulator Window`, `Compact`, `Custom`)
  - target width/height controls with persisted calibration
- Overlay badges show:
  - `Embedded Stream`
  - `Live`
  - stream connection state (`Connected`, `Reconnecting`, `Disconnected`)
  - input state (`Input Active`, `Input Inactive`)
  - serial / boot / profile metadata

## Input Interaction Model
- Click emulator stream to focus and enable keyboard forwarding.
- Tap forwarding:
  - pointer down/up with low movement threshold triggers `/android/input/tap`.
- Swipe forwarding:
  - pointer drag above threshold triggers `/android/input/swipe`.
- Keyboard/keyevent forwarding (focused stream):
  - Backspace -> `DELETE`
  - Enter -> `ENTER`
  - Escape -> `BACK`
  - Tab -> `TAB`
  - Alt+Left -> `BACK`
- Text forwarding:
  - dedicated `Send text to device` input + send button uses `/android/input/text`.

## Toolbar Controls Around Stream
- Back, Home, Recents, Enter, Delete, Power
- Screenshot Now
- Refresh Preview
- Stop Emulator

## Host-Agent Endpoints Used by UI
- `GET /android/display/frame`
- `GET /android/display/metrics`
- `GET /android/device/:serial/screenshot-now`
- `GET /android/device/:serial/info`
- `POST /android/input/tap`
- `POST /android/input/swipe`
- `POST /android/input/keyevent`
- `POST /android/input/text`
- `POST /android/emulator/stop`
- `POST /android/emulator/window/dock`
- `POST /android/emulator/window/undock`

## Safety Gating
Input controls are disabled when any of the following are true:
- host-agent offline
- no connected booted device
- stream not connected

## Known Limitations
- `adb shell input text` escaping has Android shell limitations for some characters/IME behavior.
- Stream view is not native window embedding.
- Native dock window may overlay UI and cannot be clipped like DOM.
- Coordinates use detected display size or default fallback assumptions.
- DPI and multi-monitor setups may require calibration offsets.
- Emulator titlebar/toolbar are native and remain visible in dock mode.
- Multi-touch gestures are not supported in MVP.
