# Host Requirements for Android Runtime MVP (No Docker)

## Scope
This setup prepares **host-side Android runtime prerequisites** for Windows 11 and Ubuntu using **Android SDK command-line tools only**.

This includes:
- Node.js LTS and npm
- JDK 17+
- Android SDK command-line tools (`sdkmanager`, `avdmanager`)
- Android `platform-tools` (`adb`)
- Android emulator CLI
- Android `build-tools;35.0.0` (`aapt`)
- Android `platforms;android-35`
- System images:
  - `system-images;android-35;google_apis;x86_64`
  - `system-images;android-35;google_apis_playstore;x86_64`
- AVD creation:
  - `Android_Small_Clean_API_35`
  - `Android_Small_GApps_API_35`
  - `Android_Standard_Clean_API_35`
  - `Android_Standard_GApps_API_35`

## Intentionally Excluded
- Docker installation/configuration
- Android Studio GUI
- Third-party desktop emulators: BlueStacks, Nox, LDPlayer, Genymotion Desktop

Docker is intentionally excluded from this task.

## Files
- `scripts/install-windows-requirements.ps1`
- `scripts/install-ubuntu-requirements.sh`
- `scripts/validate-runtime-requirements.ps1`
- `scripts/validate-runtime-requirements.sh`

## Environment Variables
### Windows
- `ANDROID_SDK_ROOT=C:\Android\Sdk`
- `ANDROID_HOME=C:\Android\Sdk`

PATH entries:
- `C:\Android\Sdk\cmdline-tools\latest\bin`
- `C:\Android\Sdk\platform-tools`
- `C:\Android\Sdk\emulator`
- `C:\Android\Sdk\build-tools\35.0.0`

### Ubuntu
- `ANDROID_SDK_ROOT=/opt/android-sdk`
- `ANDROID_HOME=/opt/android-sdk`

PATH entries:
- `/opt/android-sdk/cmdline-tools/latest/bin`
- `/opt/android-sdk/platform-tools`
- `/opt/android-sdk/emulator`
- `/opt/android-sdk/build-tools/35.0.0`

## Runtime Profiles
Small profiles are for fast smoke/runtime checks. Standard profiles are for modern phone compatibility.

1. `Android_Small_Clean_API_35`
- Device: `pixel_2`
- Image: `system-images;android-35;google_apis;x86_64`
- Purpose: fast lightweight smoke runtime

2. `Android_Small_GApps_API_35`
- Device: `pixel_2`
- Image: `system-images;android-35;google_apis_playstore;x86_64`
- Purpose: fast lightweight runtime for apps needing Google Play Services

3. `Android_Standard_Clean_API_35`
- Device: `pixel_7`
- Image: `system-images;android-35;google_apis;x86_64`
- Purpose: modern phone compatibility runtime

4. `Android_Standard_GApps_API_35`
- Device: `pixel_7`
- Image: `system-images;android-35;google_apis_playstore;x86_64`
- Purpose: modern phone runtime for apps needing Google Play Services

Notes:
- Clean profiles are lighter.
- GApps profiles are heavier but needed for Google Sign-In, Maps, Firebase, FCM, Play Services, and Play Store dependent apps.
- `pixel_2` is a hardware profile only; Android feature/API support comes from the API 35 system image.
- `pixel_7` profile is included for modern phone compatibility.

## Windows 11 Setup
Run PowerShell as Administrator when possible.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\install-windows-requirements.ps1
.\scripts\validate-runtime-requirements.ps1
```

## Ubuntu Setup

```bash
chmod +x scripts/install-ubuntu-requirements.sh scripts/validate-runtime-requirements.sh
./scripts/install-ubuntu-requirements.sh
source ~/.profile
./scripts/validate-runtime-requirements.sh
```

## Emulator Start Commands
Lightweight clean:
```bash
emulator -avd Android_Small_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2
```

Lightweight GApps:
```bash
emulator -avd Android_Small_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2
```

Standard clean:
```bash
emulator -avd Android_Standard_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2
```

Standard GApps:
```bash
emulator -avd Android_Standard_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2
```

## Validation Commands (Manual)
- `node --version`
- `npm --version`
- `java -version`
- `sdkmanager --version`
- `avdmanager list avd`
- `emulator -version`
- `emulator -list-avds`
- `adb version`
- `adb devices`
- `aapt v`

## Troubleshooting
### sdkmanager not found
- Confirm `cmdline-tools/latest/bin` exists inside SDK root.
- Confirm PATH includes SDK command-line tools path.
- Re-open terminal after installation.

### adb not found
- Confirm PATH includes `platform-tools`.
- Validate `adb` exists in SDK root `platform-tools` directory.

### emulator not found
- Confirm PATH includes SDK `emulator` directory.
- Validate emulator package is installed via `sdkmanager`.

### AVD not found
- Run `emulator -list-avds` and `avdmanager list avd`.
- Re-run install script to create missing AVD profiles.

### license not accepted
- Run `sdkmanager --licenses` (or `yes | sdkmanager --licenses` on Ubuntu).

### emulator acceleration issue
- Windows: enable CPU virtualization in BIOS and enable Windows features:
  - Windows Hypervisor Platform
  - Virtual Machine Platform
- Ubuntu: verify `/dev/kvm` exists and user belongs to `kvm`/`libvirt`.

### KVM issue on Ubuntu
- Check: `ls -l /dev/kvm`
- Check groups: `groups`
- If group changed, logout/login or reboot.

### Windows virtualization issue
- Ensure virtualization is enabled in BIOS/UEFI.
- Reboot after enabling required Windows features.

### Play Store image heavier than clean image
- `google_apis_playstore` image uses more resources and may boot slower.
- Prefer `Android_Small_Clean_API_35` for fastest smoke checks and `Android_Standard_Clean_API_35` for modern layout compatibility.