# Native Window Dock (Experimental)

## What It Is
Native Window Dock is not true DOM embedding. It positions the real Android Emulator OS window over a reserved area inside the Electron runtime UI.

## Product Rule
- `Embedded Stream - Stable` remains the default and recommended mode.
- `Native Window Dock - Experimental` is optional.
- SetParent embedding is not default due to black GPU render surface risk.
- Native dock does not use SetParent in the default path.

## Flow
1. Renderer reads `#nativeDockTarget` DOM rect.
2. Renderer sends rect + serial/avd to Electron main via `runtimeDock` bridge.
3. Electron main maps client rect to screen coordinates and applies optional offsets.
4. Electron main calls host-agent `/android/emulator/window/dock`.
5. Host-agent uses OS window APIs to move/resize the real emulator window.

## Windows
- Implementation uses `SetWindowPos` through `services/host-agent/native/windows/window-dock.ps1`.
- Window matching supports `qemu-system-x86_64` and `Android Emulator` title matching.
- Emulator must run in windowed mode (not `-no-window`).

## Ubuntu
- Optional support if `wmctrl` or `xdotool` is installed on X11.
- Wayland may block global window positioning.
- If tools are missing, host-agent returns:
  - `native_dock_requires_wmctrl_or_xdotool_on_ubuntu`

## Environment Offsets
- `NATIVE_DOCK_OFFSET_X` (default `0`)
- `NATIVE_DOCK_OFFSET_Y` (default `0`)
- `NATIVE_DOCK_WIDTH_DELTA` (default `0`)
- `NATIVE_DOCK_HEIGHT_DELTA` (default `0`)
- `NATIVE_DOCK_TITLEBAR_OFFSET` (default `0`)

## DPI and Multi-Monitor Notes
- Small offset drift can happen because Chromium client coordinates, window frames, and Windows DPI scaling are not always exact.
- Use calibration controls or offset env vars to fine-tune.

## Auto Re-dock
- When native dock is active, Electron re-docks on window move/resize/restore/unmaximize.
- Re-dock is debounced to avoid request spam.
- Renderer also re-docks on calibration changes, fit-mode changes, tab/layout changes, and scroll/layout updates.

## Fit Modes
- `Full Emulator Window` (default): `360x560`
- `Compact`: `320x520`
- `Custom`: user-controlled target width/height
- Stored in localStorage:
  - `nativeDockFitMode`
  - `nativeDockTargetWidth`
  - `nativeDockTargetHeight`

## Calibration Controls
- Offset X / Offset Y
- Width Delta / Height Delta
- Target Width / Target Height
- Actions:
  - `Apply & Re-dock`
  - `Reset Calibration`
  - `Center Target`
  - `Fit Full Emulator Window`

## Troubleshooting
- Emulator window not found:
  - Confirm emulator is running and visible in Windows desktop.
  - Confirm title contains `Android Emulator`.
- Wrong offset or wrong panel coverage:
  - Tune `NATIVE_DOCK_*` env vars.
- Emulator behind Electron:
  - Use `Dock Emulator Window` or `Re-dock` again.
- Dock breaks after resize/move:
  - Re-dock is auto-triggered with debounce, then manual `Re-dock` if needed.
- Return to stream:
  - Click `Return to Stream` anytime; stream mode remains stable fallback.
  - On dock failure, UI falls back to stream mode automatically.

## Known Limitations
- Emulator window may float over UI and does not clip like DOM content.
- DPI/multi-monitor offsets may need calibration.
- Full emulator window includes native titlebar/toolbar, so slight visual differences may remain.
- OS window manager policies can block or desync re-positioning.
- Ubuntu requires `wmctrl`/`xdotool` on X11; Wayland may block positioning.
