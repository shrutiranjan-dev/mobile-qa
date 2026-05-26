# Embedded Stream Input

## Overview
This document describes stream-powered embedded emulator interaction in the Electron cockpit.

## Design
Electron stream viewport
-> Host Agent input endpoint
-> adb input command
-> Android emulator/device

Streaming remains the primary/default display path.

## Endpoints

### 1) Tap
`POST /android/input/tap`

Payload:
```json
{
  "serial": "emulator-5554",
  "x": 540,
  "y": 960
}
```

### 2) Swipe
`POST /android/input/swipe`

Payload:
```json
{
  "serial": "emulator-5554",
  "x1": 500,
  "y1": 1600,
  "x2": 500,
  "y2": 400,
  "durationMs": 450
}
```

### 3) Keyevent
`POST /android/input/keyevent`

Supported keys:
- `BACK`
- `HOME`
- `RECENTS`
- `ENTER`
- `DELETE`
- `TAB`
- `ESCAPE`
- `POWER`

Payload:
```json
{
  "serial": "emulator-5554",
  "key": "BACK"
}
```

### 4) Text
`POST /android/input/text`

Payload:
```json
{
  "serial": "emulator-5554",
  "text": "hello world"
}
```

### 5) Screenshot now
`GET /android/device/:serial/screenshot-now`

Example:
- `http://localhost:5050/android/device/emulator-5554/screenshot-now`

### 6) Device info helper
`GET /android/device/:serial/info`

Response includes serial/state/bootCompleted/width/height.

## Manual Test Commands

Tap:
```powershell
curl.exe -X POST http://localhost:5050/android/input/tap -H "Content-Type: application/json" -d "{\"serial\":\"emulator-5554\",\"x\":540,\"y\":960}"
```

Swipe:
```powershell
curl.exe -X POST http://localhost:5050/android/input/swipe -H "Content-Type: application/json" -d "{\"serial\":\"emulator-5554\",\"x1\":500,\"y1\":1600,\"x2\":500,\"y2\":400,\"durationMs\":450}"
```

Back:
```powershell
curl.exe -X POST http://localhost:5050/android/input/keyevent -H "Content-Type: application/json" -d "{\"serial\":\"emulator-5554\",\"key\":\"BACK\"}"
```

Text:
```powershell
curl.exe -X POST http://localhost:5050/android/input/text -H "Content-Type: application/json" -d "{\"serial\":\"emulator-5554\",\"text\":\"hello world\"}"
```

Screenshot:
- Open `http://localhost:5050/android/device/emulator-5554/screenshot-now`

## UI Checklist
1. Open Electron app and confirm live stream visible.
2. Click stream, verify `Input Active` badge.
3. Tap inside stream, verify device reacts.
4. Drag/swipe inside stream, verify device reacts.
5. Use Back/Home/Recents/Enter/Delete buttons.
6. Send text from `Send text to device` field.
7. Click Screenshot Now, verify frame updates.
8. Run Upload & Run and verify artifacts still populate.

## Troubleshooting
- If controls disabled: verify host-agent health and bootCompleted=true.
- If stream disconnected: use Reconnect and check `/android/devices` state.
- If text appears partially: adb input text escaping/IME behavior is expected limitation.
- If tap feels offset: verify `/android/device/:serial/info` dimensions and stream letterboxing.
