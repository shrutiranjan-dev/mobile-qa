[CmdletBinding()]
param(
  [string]$AndroidSdkRoot = 'C:\Android\Sdk'
)

$ErrorActionPreference = 'Stop'

function Log([string]$Level, [string]$Message) {
  Write-Host ("{0} {1}" -f $Level, $Message)
}

function Require-AdminIfNeeded {
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Log '[WARN]' 'Script is not running as Administrator. System-level installs and machine environment updates may fail.'
  } else {
    Log '[OK]' 'Running with Administrator privileges.'
  }
}

function Ensure-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-WingetPackage([string]$CommandName, [string]$WingetId, [string]$FriendlyName) {
  if (Ensure-Command $CommandName) {
    Log '[SKIP]' "$FriendlyName already installed."
    return
  }

  if (Ensure-Command 'winget') {
    Log '[INSTALL]' "Installing $FriendlyName via winget ($WingetId)..."
    winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements --silent
    if (Ensure-Command $CommandName) {
      Log '[OK]' "$FriendlyName installed successfully."
    } else {
      Log '[ERROR]' "$FriendlyName installation was attempted but '$CommandName' is still unavailable. Reopen terminal and retry."
      throw "$FriendlyName missing"
    }
  } else {
    Log '[WARN]' "winget not found. Please install $FriendlyName manually and rerun script."
    Log '[WARN]' "Suggested package: $WingetId"
    throw "winget not available for $FriendlyName"
  }
}

function Ensure-Directory([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Log '[SKIP]' "Directory exists: $Path"
  } else {
    Log '[INSTALL]' "Creating directory: $Path"
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    Log '[OK]' "Created directory: $Path"
  }
}

function Download-AndroidCmdlineTools([string]$SdkRoot) {
  $latestBin = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
  if (Test-Path -LiteralPath $latestBin) {
    Log '[SKIP]' 'Android command-line tools already present.'
    return
  }

  $url = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
  $zipPath = Join-Path $env:TEMP 'android-cmdline-tools-win.zip'
  $extractRoot = Join-Path $env:TEMP 'android-cmdline-tools-extract'
  $targetRoot = Join-Path $SdkRoot 'cmdline-tools'
  $latestDir = Join-Path $targetRoot 'latest'

  Log '[INSTALL]' "Downloading Android command-line tools from official source: $url"
  Invoke-WebRequest -Uri $url -OutFile $zipPath

  if (Test-Path -LiteralPath $extractRoot) {
    Remove-Item -Recurse -Force -LiteralPath $extractRoot
  }
  New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null

  Log '[INSTALL]' 'Extracting Android command-line tools...'
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

  $sourceCmdline = Join-Path $extractRoot 'cmdline-tools'
  if (-not (Test-Path -LiteralPath $sourceCmdline)) {
    Log '[ERROR]' 'Unexpected archive structure: cmdline-tools directory not found.'
    throw 'Invalid Android command-line tools archive'
  }

  Ensure-Directory $targetRoot
  if (-not (Test-Path -LiteralPath $latestDir)) {
    New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
  }

  Log '[INSTALL]' 'Copying command-line tools to cmdline-tools\latest...'
  Get-ChildItem -LiteralPath $sourceCmdline | ForEach-Object {
    Copy-Item -Recurse -Force -LiteralPath $_.FullName -Destination $latestDir
  }

  if (-not (Test-Path -LiteralPath $latestBin)) {
    Log '[ERROR]' 'sdkmanager.bat not found after extraction.'
    throw 'Android command-line tools installation failed'
  }

  Log '[OK]' 'Android command-line tools installed.'
}

function Ensure-EnvVar([string]$Name, [string]$Value) {
  $currentMachine = [Environment]::GetEnvironmentVariable($Name, 'Machine')
  if ($currentMachine -eq $Value) {
    Log '[SKIP]' "Machine env var already set: $Name=$Value"
  } else {
    try {
      [Environment]::SetEnvironmentVariable($Name, $Value, 'Machine')
      Log '[OK]' "Set machine env var: $Name=$Value"
    } catch {
      Log '[WARN]' "Unable to set machine env var $Name. Setting user env var instead."
      [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
      Log '[OK]' "Set user env var: $Name=$Value"
    }
  }

  Set-Item -Path "Env:$Name" -Value $Value
}

function Ensure-PathEntry([string]$Entry) {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  if ([string]::IsNullOrWhiteSpace($machinePath)) { $machinePath = '' }

  $entries = $machinePath -split ';' | Where-Object { $_ -ne '' }
  if ($entries -contains $Entry) {
    Log '[SKIP]' "PATH contains: $Entry"
  } else {
    try {
      $newPath = if ($machinePath.TrimEnd(';')) { "$machinePath;$Entry" } else { $Entry }
      [Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')
      Log '[OK]' "Added to machine PATH: $Entry"
    } catch {
      Log '[WARN]' "Unable to set machine PATH. Adding to user PATH: $Entry"
      $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
      if ([string]::IsNullOrWhiteSpace($userPath)) { $userPath = '' }
      if (($userPath -split ';') -notcontains $Entry) {
        $newUserPath = if ($userPath.TrimEnd(';')) { "$userPath;$Entry" } else { $Entry }
        [Environment]::SetEnvironmentVariable('Path', $newUserPath, 'User')
        Log '[OK]' "Added to user PATH: $Entry"
      } else {
        Log '[SKIP]' "User PATH already contains: $Entry"
      }
    }
  }

  if (($env:Path -split ';') -notcontains $Entry) {
    $env:Path = "$env:Path;$Entry"
  }
}

function Ensure-SdkPackages([string]$SdkRoot) {
  $sdkmanager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
  if (-not (Test-Path -LiteralPath $sdkmanager)) {
    Log '[ERROR]' "sdkmanager not found at expected path: $sdkmanager"
    throw 'sdkmanager missing'
  }

  $packages = @(
    'platform-tools',
    'emulator',
    'platforms;android-35',
    'build-tools;35.0.0',
    'system-images;android-35;google_apis;x86_64',
    'system-images;android-35;google_apis_playstore;x86_64'
  )

  Log '[INSTALL]' 'Accepting Android SDK licenses...'
  cmd /c "`"$sdkmanager`" --licenses"

  Log '[INSTALL]' 'Installing/updating required SDK packages...'
  & $sdkmanager @packages
  Log '[OK]' 'SDK packages installation step completed.'
}

function Ensure-Avd([string]$SdkRoot, [string]$Name, [string]$Image, [string]$Device) {
  $avdmanager = Join-Path $SdkRoot 'cmdline-tools\latest\bin\avdmanager.bat'
  if (-not (Test-Path -LiteralPath $avdmanager)) {
    Log '[ERROR]' "avdmanager not found at expected path: $avdmanager"
    throw 'avdmanager missing'
  }

  $avdList = & $avdmanager list avd
  if ($avdList -match "Name:\s+$([regex]::Escape($Name))") {
    Log '[SKIP]' "AVD already exists: $Name"
    return
  }

  Log '[INSTALL]' "Creating AVD: $Name"
  $createCmd = "echo no | `"$avdmanager`" create avd -n $Name -k `"$Image`" -d $Device"
  cmd /c $createCmd | Out-Null
  Log '[OK]' "Created AVD: $Name"
}

Log '[CHECK]' 'Starting Windows host requirements installation (excluding Docker, Android Studio GUI, third-party emulators).'
Require-AdminIfNeeded

Ensure-WingetPackage -CommandName 'node' -WingetId 'OpenJS.NodeJS.LTS' -FriendlyName 'Node.js LTS (includes npm)'
Ensure-WingetPackage -CommandName 'java' -WingetId 'Microsoft.OpenJDK.17' -FriendlyName 'JDK 17+'

Ensure-Directory $AndroidSdkRoot
Download-AndroidCmdlineTools -SdkRoot $AndroidSdkRoot

Ensure-EnvVar -Name 'ANDROID_SDK_ROOT' -Value $AndroidSdkRoot
Ensure-EnvVar -Name 'ANDROID_HOME' -Value $AndroidSdkRoot

Ensure-PathEntry (Join-Path $AndroidSdkRoot 'cmdline-tools\latest\bin')
Ensure-PathEntry (Join-Path $AndroidSdkRoot 'platform-tools')
Ensure-PathEntry (Join-Path $AndroidSdkRoot 'emulator')
Ensure-PathEntry (Join-Path $AndroidSdkRoot 'build-tools\35.0.0')

Ensure-SdkPackages -SdkRoot $AndroidSdkRoot
Ensure-Avd -SdkRoot $AndroidSdkRoot -Name 'Android_Small_Clean_API_35' -Image 'system-images;android-35;google_apis;x86_64' -Device 'pixel_2'
Ensure-Avd -SdkRoot $AndroidSdkRoot -Name 'Android_Small_GApps_API_35' -Image 'system-images;android-35;google_apis_playstore;x86_64' -Device 'pixel_2'
Ensure-Avd -SdkRoot $AndroidSdkRoot -Name 'Android_Standard_Clean_API_35' -Image 'system-images;android-35;google_apis;x86_64' -Device 'pixel_7'
Ensure-Avd -SdkRoot $AndroidSdkRoot -Name 'Android_Standard_GApps_API_35' -Image 'system-images;android-35;google_apis_playstore;x86_64' -Device 'pixel_7'

Log '[OK]' 'Windows host requirements setup complete.'
Log '[WARN]' 'If emulator acceleration fails, enable virtualization in BIOS and Windows features: Windows Hypervisor Platform + Virtual Machine Platform.'
Log '[OK]' 'Example start commands:'
Write-Host 'emulator -avd Android_Small_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2'
Write-Host 'emulator -avd Android_Small_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 2048 -cores 2'
Write-Host 'emulator -avd Android_Standard_Clean_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2'
Write-Host 'emulator -avd Android_Standard_GApps_API_35 -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -cores 2'