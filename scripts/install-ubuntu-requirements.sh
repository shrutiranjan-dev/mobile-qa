#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-/opt/android-sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"

log() {
  local level="$1"
  shift
  echo "${level} $*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "[ERROR]" "Required command missing: $cmd"
    exit 1
  fi
}

check_sudo() {
  if command -v sudo >/dev/null 2>&1; then
    if sudo -n true >/dev/null 2>&1; then
      log "[OK]" "sudo is available."
    else
      log "[WARN]" "sudo may prompt for password during installation."
    fi
  else
    log "[ERROR]" "sudo is required for package and /opt setup."
    exit 1
  fi
}

install_apt_package() {
  local pkg="$1"
  if dpkg -s "$pkg" >/dev/null 2>&1; then
    log "[SKIP]" "Package already installed: $pkg"
  else
    log "[INSTALL]" "Installing package: $pkg"
    sudo apt-get install -y "$pkg"
    log "[OK]" "Installed package: $pkg"
  fi
}

install_node_lts() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "[SKIP]" "Node.js and npm already installed."
    return
  fi

  log "[INSTALL]" "Installing Node.js LTS using NodeSource setup script."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "[OK]" "Node.js LTS installed."
  else
    log "[ERROR]" "Node.js/npm installation failed."
    exit 1
  fi
}

ensure_android_cmdline_tools() {
  local sdk_root="$1"
  local sdkmanager_path="$sdk_root/cmdline-tools/latest/bin/sdkmanager"

  if [[ -x "$sdkmanager_path" ]]; then
    log "[SKIP]" "Android command-line tools already present."
    return
  fi

  log "[INSTALL]" "Creating Android SDK root at $sdk_root"
  sudo mkdir -p "$sdk_root/cmdline-tools"
  sudo chown -R "$USER":"$USER" "$sdk_root"

  local zip_path="/tmp/android-cmdline-tools-linux.zip"
  local extract_dir="/tmp/android-cmdline-tools-extract"

  log "[INSTALL]" "Downloading Android command-line tools from official source."
  wget -O "$zip_path" "$CMDLINE_TOOLS_URL"

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  unzip -q -o "$zip_path" -d "$extract_dir"

  if [[ ! -d "$extract_dir/cmdline-tools" ]]; then
    log "[ERROR]" "Unexpected archive structure: cmdline-tools directory missing."
    exit 1
  fi

  mkdir -p "$sdk_root/cmdline-tools/latest"
  cp -r "$extract_dir/cmdline-tools/." "$sdk_root/cmdline-tools/latest/"

  if [[ ! -x "$sdkmanager_path" ]]; then
    log "[ERROR]" "sdkmanager missing after extraction."
    exit 1
  fi

  log "[OK]" "Android command-line tools installed."
}

ensure_profile_exports() {
  local profile_file="$HOME/.profile"
  local begin_marker="# >>> android-runtime-mvp >>>"
  local end_marker="# <<< android-runtime-mvp <<<"

  if grep -Fq "$begin_marker" "$profile_file" 2>/dev/null; then
    log "[SKIP]" "Android SDK environment block already present in $profile_file"
    return
  fi

  log "[INSTALL]" "Appending Android SDK environment variables to $profile_file"
  {
    echo "$begin_marker"
    echo "export ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
    echo "export ANDROID_HOME=$ANDROID_HOME"
    echo "export PATH=\$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/build-tools/35.0.0"
    echo "$end_marker"
  } >> "$profile_file"

  log "[OK]" "Updated $profile_file"
}

ensure_current_shell_env() {
  export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
  export ANDROID_HOME="$ANDROID_HOME"
  export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/build-tools/35.0.0"
}

install_sdk_packages() {
  require_cmd sdkmanager

  local packages=(
    "platform-tools"
    "emulator"
    "platforms;android-35"
    "build-tools;35.0.0"
    "system-images;android-35;google_apis;x86_64"
    "system-images;android-35;google_apis_playstore;x86_64"
  )

  log "[INSTALL]" "Accepting Android SDK licenses."
  yes | sdkmanager --licenses >/dev/null

  log "[INSTALL]" "Installing/updating required SDK packages."
  sdkmanager "${packages[@]}"
  log "[OK]" "SDK packages installation step completed."
}

ensure_avd() {
  local name="$1"
  local image="$2"
  local device="$3"

  if avdmanager list avd | grep -Eq "Name:\s+$name"; then
    log "[SKIP]" "AVD already exists: $name"
    return
  fi

  log "[INSTALL]" "Creating AVD: $name"
  echo "no" | avdmanager create avd -n "$name" -k "$image" -d "$device" >/dev/null
  log "[OK]" "Created AVD: $name"
}

configure_kvm_groups() {
  local added=0
  if getent group kvm >/dev/null 2>&1; then
    if id -nG "$USER" | grep -qw kvm; then
      log "[SKIP]" "User already in group: kvm"
    else
      sudo usermod -aG kvm "$USER"
      log "[OK]" "Added user to group: kvm"
      added=1
    fi
  else
    log "[WARN]" "Group 'kvm' not found."
  fi

  if getent group libvirt >/dev/null 2>&1; then
    if id -nG "$USER" | grep -qw libvirt; then
      log "[SKIP]" "User already in group: libvirt"
    else
      sudo usermod -aG libvirt "$USER"
      log "[OK]" "Added user to group: libvirt"
      added=1
    fi
  else
    log "[WARN]" "Group 'libvirt' not found."
  fi

  if [[ "$added" -eq 1 ]]; then
    log "[WARN]" "Group changes require logout/login (or reboot) to take effect."
  fi
}

main() {
  log "[CHECK]" "Starting Ubuntu host requirements installation (excluding Docker, Android Studio GUI, third-party emulators)."

  check_sudo
  require_cmd apt-get
  require_cmd curl
  require_cmd wget
  require_cmd unzip

  log "[INSTALL]" "Updating apt package index."
  sudo apt-get update -y

  install_apt_package openjdk-17-jdk
  install_apt_package unzip
  install_apt_package curl
  install_apt_package wget
  install_apt_package qemu-kvm
  install_apt_package libvirt-daemon-system
  install_apt_package libvirt-clients
  install_apt_package bridge-utils

  install_node_lts

  ensure_android_cmdline_tools "$ANDROID_SDK_ROOT"
  ensure_profile_exports
  ensure_current_shell_env

  install_sdk_packages

  ensure_avd "Android_Small_Clean_API_35" "system-images;android-35;google_apis;x86_64" "pixel_2"
  ensure_avd "Android_Small_GApps_API_35" "system-images;android-35;google_apis_playstore;x86_64" "pixel_2"
  ensure_avd "Android_Standard_Clean_API_35" "system-images;android-35;google_apis;x86_64" "pixel_7"
  ensure_avd "Android_Standard_GApps_API_35" "system-images;android-35;google_apis_playstore;x86_64" "pixel_7"

  configure_kvm_groups

  log "[OK]" "Ubuntu host requirements setup complete."
  log "[OK]" "Example start commands:"
  echo "emulator -avd Android_Small_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2"
  echo "emulator -avd Android_Small_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2"
  echo "emulator -avd Android_Standard_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2"
  echo "emulator -avd Android_Standard_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2"
}

main "$@"