#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
FAILURES=0

log() {
  local level="$1"
  shift
  echo "${level} $*"
}

record_failure() {
  FAILURES=$((FAILURES + 1))
}

assert_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    log "[OK]" "Command available: $cmd"
    return 0
  fi
  log "[ERROR]" "Command missing: $cmd"
  record_failure
  return 1
}

assert_env() {
  local name="$1"
  local expected="$2"
  local actual="${!name:-}"
  if [[ "$actual" == "$expected" ]]; then
    log "[OK]" "$name is set to $expected"
  else
    log "[WARN]" "$name expected '$expected' but found '$actual'"
  fi
}

assert_path_contains() {
  local needle="$1"
  if [[ ":$PATH:" == *":$needle:"* ]]; then
    log "[OK]" "PATH contains: $needle"
  else
    log "[WARN]" "PATH missing: $needle"
  fi
}

assert_file() {
  local path="$1"
  local label="$2"
  if [[ -e "$path" ]]; then
    log "[OK]" "$label found: $path"
  else
    log "[ERROR]" "$label missing: $path"
    record_failure
  fi
}

assert_sdk_package() {
  local pkg="$1"
  if sdkmanager --list_installed 2>/dev/null | grep -Fq "$pkg"; then
    log "[OK]" "SDK package installed: $pkg"
  else
    log "[ERROR]" "SDK package missing: $pkg"
    record_failure
  fi
}

assert_avd() {
  local name="$1"
  if avdmanager list avd | grep -Eq "Name:\s+$name"; then
    log "[OK]" "AVD exists: $name"
  else
    log "[ERROR]" "AVD missing: $name"
    record_failure
  fi
}

check_kvm() {
  if [[ -e /dev/kvm ]]; then
    log "[OK]" "/dev/kvm is available"
  else
    log "[WARN]" "/dev/kvm not found. Emulator acceleration may be unavailable."
  fi

  if command -v kvm-ok >/dev/null 2>&1; then
    if kvm-ok >/dev/null 2>&1; then
      log "[OK]" "kvm-ok reports KVM acceleration available"
    else
      log "[WARN]" "kvm-ok indicates KVM acceleration is not available"
    fi
  fi
}

log "[CHECK]" "Validating Ubuntu runtime host requirements."

assert_cmd node && node --version || true
assert_cmd npm && npm --version || true
assert_cmd java && java -version || true
assert_cmd sdkmanager && sdkmanager --version || true
assert_cmd avdmanager && avdmanager list avd || true
assert_cmd emulator && emulator -version || true
assert_cmd adb && adb version || true

assert_env ANDROID_SDK_ROOT "$ANDROID_SDK_ROOT"
assert_env ANDROID_HOME "$ANDROID_HOME"

assert_path_contains "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin"
assert_path_contains "$ANDROID_SDK_ROOT/platform-tools"
assert_path_contains "$ANDROID_SDK_ROOT/emulator"
assert_path_contains "$ANDROID_SDK_ROOT/build-tools/35.0.0"

assert_file "$ANDROID_SDK_ROOT/build-tools/35.0.0/aapt" "aapt"
if [[ -x "$ANDROID_SDK_ROOT/build-tools/35.0.0/aapt" ]]; then
  "$ANDROID_SDK_ROOT/build-tools/35.0.0/aapt" v || true
fi

if command -v sdkmanager >/dev/null 2>&1; then
  assert_sdk_package "platform-tools"
  assert_sdk_package "emulator"
  assert_sdk_package "platforms;android-35"
  assert_sdk_package "build-tools;35.0.0"
  assert_sdk_package "system-images;android-35;google_apis;x86_64"
  assert_sdk_package "system-images;android-35;google_apis_playstore;x86_64"
fi

if command -v emulator >/dev/null 2>&1; then
  log "[CHECK]" "Listing AVDs from emulator"
  emulator -list-avds || true
fi

if command -v adb >/dev/null 2>&1; then
  log "[CHECK]" "Listing adb devices"
  adb devices || true
fi

if command -v avdmanager >/dev/null 2>&1; then
  assert_avd "Android_Small_Clean_API_35"
  assert_avd "Android_Small_GApps_API_35"
  assert_avd "Android_Standard_Clean_API_35"
  assert_avd "Android_Standard_GApps_API_35"
fi

check_kvm

if [[ "$FAILURES" -gt 0 ]]; then
  log "[ERROR]" "Validation completed with $FAILURES failure(s)."
  exit 1
fi

log "[OK]" "Validation completed successfully."