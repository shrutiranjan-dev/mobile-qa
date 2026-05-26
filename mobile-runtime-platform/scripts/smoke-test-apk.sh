#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-}"
DEVICE_SERIAL="${2:-emulator-5554}"
RUNTIME_PROFILE="${3:-Android_Small_Clean_API_35}"

if [[ -z "$APK_PATH" ]]; then
  echo "[ERROR] Usage: ./scripts/smoke-test-apk.sh <apkPath> [deviceSerial] [runtimeProfile]"
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "[ERROR] APK file not found: $APK_PATH"
  exit 1
fi

log() {
  echo "$1 $2"
}

health() {
  local name="$1"
  local url="$2"
  local status
  status=$(curl -s "$url" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  if [[ "$status" == "ok" ]]; then
    log "[OK]" "$name health: $url"
  else
    log "[ERROR]" "$name health check failed: $url"
    exit 1
  fi
}

health "host-agent" "http://localhost:5050/health"
health "backend-api" "http://localhost:4000/health"
health "android-worker" "http://localhost:6060/health"

if ! curl -s "http://localhost:5050/android/devices" | grep -q "$DEVICE_SERIAL"; then
  log "[ERROR]" "Device not found: $DEVICE_SERIAL"
  exit 1
fi
log "[OK]" "Device ready: $DEVICE_SERIAL"

upload_json=$(curl -s -F "apk=@$APK_PATH" http://localhost:4000/apps/upload)
apk_uploaded_path=$(echo "$upload_json" | sed -n 's/.*"apkPath":"\([^"]*\)".*/\1/p')
if [[ -z "$apk_uploaded_path" ]]; then
  log "[ERROR]" "Upload failed: $upload_json"
  exit 1
fi
log "[OK]" "Upload complete"

run_json=$(curl -s -X POST http://localhost:4000/runtime/android/run \
  -H "Content-Type: application/json" \
  -d "{\"apkPath\":\"$apk_uploaded_path\",\"deviceSerial\":\"$DEVICE_SERIAL\",\"runtimeProfile\":\"$RUNTIME_PROFILE\"}")

job_id=$(echo "$run_json" | sed -n 's/.*"jobId":"\([^"]*\)".*/\1/p')
if [[ -z "$job_id" ]]; then
  log "[ERROR]" "Run failed: $run_json"
  exit 1
fi

log "[OK]" "Job created: $job_id"

status="queued"
for _ in $(seq 1 120); do
  sleep 2
  job_json=$(curl -s "http://localhost:4000/runtime/jobs/$job_id")
  status=$(echo "$job_json" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  log "[CHECK]" "Job status: $status"
  if [[ "$status" == "passed" || "$status" == "failed" || "$status" == "blocked" ]]; then
    break
  fi
done

report_url="http://localhost:4000/artifacts/jobs/$job_id/report.json"
screenshot_url="http://localhost:4000/artifacts/jobs/$job_id/screenshots/launch.png"
logcat_url="http://localhost:4000/artifacts/jobs/$job_id/logs/logcat.txt"

echo "report: $report_url"
echo "screenshot: $screenshot_url"
echo "logcat: $logcat_url"

curl -fsS "$report_url" >/dev/null && log "[OK]" "report.json available" || log "[ERROR]" "report.json unavailable"
curl -fsS "$screenshot_url" >/dev/null && log "[OK]" "launch.png available" || log "[WARN]" "launch.png unavailable"
curl -fsS "$logcat_url" >/dev/null && log "[OK]" "logcat.txt available" || log "[WARN]" "logcat.txt unavailable"

if [[ "$status" == "passed" ]]; then
  exit 0
fi

exit 1