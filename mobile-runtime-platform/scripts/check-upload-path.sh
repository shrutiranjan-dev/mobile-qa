#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-}"
DEVICE_SERIAL="${2:-emulator-5554}"
RUNTIME_PROFILE="${3:-Android_Small_Clean_API_35}"
DOCKER_MODE="${4:-false}"

if [[ -z "$APK_PATH" ]]; then
  echo "[ERROR] Usage: ./scripts/check-upload-path.sh <apkPath> [deviceSerial] [runtimeProfile] [dockerMode:true|false]"
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
  if [[ "$status" != "ok" ]]; then
    log "[ERROR]" "$name health check failed: $url"
    exit 1
  fi
  log "[OK]" "$name health: $url"
}

health "backend-api" "http://localhost:4000/health"

upload_json=$(curl -s -X POST -F "apk=@$APK_PATH" http://localhost:4000/apps/upload)
app_id=$(echo "$upload_json" | sed -n 's/.*"appId":"\([^"]*\)".*/\1/p')
file_name=$(echo "$upload_json" | sed -n 's/.*"fileName":"\([^"]*\)".*/\1/p')
apk_uploaded_path=$(echo "$upload_json" | sed -n 's/.*"apkPath":"\([^"]*\)".*/\1/p')

if [[ -z "$app_id" || -z "$file_name" || -z "$apk_uploaded_path" ]]; then
  log "[ERROR]" "Upload response missing appId/fileName/apkPath: $upload_json"
  exit 1
fi

if [[ "$apk_uploaded_path" != /* ]]; then
  log "[ERROR]" "apkPath is relative: $apk_uploaded_path"
  exit 1
fi

if [[ "$apk_uploaded_path" == *\\* ]]; then
  log "[ERROR]" "apkPath contains backslashes: $apk_uploaded_path"
  exit 1
fi

if [[ "$DOCKER_MODE" == "true" && "$apk_uploaded_path" != /app/uploads/* ]]; then
  log "[ERROR]" "Docker mode requires apkPath to start with /app/uploads/: $apk_uploaded_path"
  exit 1
fi

log "[OK]" "Upload path checks passed: $apk_uploaded_path"

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
reason=""
for _ in $(seq 1 120); do
  sleep 2
  job_json=$(curl -s "http://localhost:4000/runtime/jobs/$job_id")
  status=$(echo "$job_json" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  reason=$(echo "$job_json" | sed -n 's/.*"reason":"\([^"]*\)".*/\1/p')
  log "[CHECK]" "Job status: $status"
  if [[ "$status" == "passed" || "$status" == "failed" || "$status" == "blocked" ]]; then
    break
  fi
done

if [[ "$status" != "passed" && "$status" != "failed" && "$status" != "blocked" ]]; then
  log "[ERROR]" "Job polling timed out"
  exit 1
fi

if [[ ( "$status" == "failed" || "$status" == "blocked" ) && ( "$reason" == *"APK does not exist"* || "$reason" == *"apk_missing"* ) ]]; then
  log "[ERROR]" "Path regression detected: status=$status reason=$reason"
  exit 1
fi

report_url="http://localhost:4000/artifacts/jobs/$job_id/report.json"
screenshot_url="http://localhost:4000/artifacts/jobs/$job_id/screenshots/launch.png"
logcat_url="http://localhost:4000/artifacts/jobs/$job_id/logs/logcat.txt"

echo "jobId: $job_id"
echo "report: $report_url"
echo "screenshot: $screenshot_url"
echo "logcat: $logcat_url"

log "[OK]" "Terminal job status: $status"

if [[ "$status" == "passed" ]]; then
  exit 0
fi

exit 1
