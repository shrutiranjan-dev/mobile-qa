[CmdletBinding()]
param(
  [string]$AndroidSdkRoot = 'C:\Android\Sdk'
)

$ErrorActionPreference = 'Continue'
$script:Failures = 0

function Log([string]$Level, [string]$Message) {
  Write-Host ("{0} {1}" -f $Level, $Message)
}

function Assert-Command([string]$Cmd) {
  if (Get-Command $Cmd -ErrorAction SilentlyContinue) {
    Log '[OK]' "Command available: $Cmd"
    return $true
  }
  Log '[ERROR]' "Command missing: $Cmd"
  $script:Failures++
  return $false
}

function Assert-Env([string]$Name, [string]$Expected) {
  $actual = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if (-not $actual) { $actual = [Environment]::GetEnvironmentVariable($Name, 'User') }
  if (-not $actual) { $actual = [Environment]::GetEnvironmentVariable($Name, 'Machine') }

  if ($actual -eq $Expected) {
    Log '[OK]' "$Name is set to $Expected"
  } else {
    Log '[WARN]' "$Name expected '$Expected' but found '$actual'"
  }
}

function Assert-PathContains([string]$Entry) {
  $allPaths = @()
  $allPaths += (($env:Path -split ';') | Where-Object { $_ })
  $allPaths += (([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') | Where-Object { $_ })
  $allPaths += (([Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';') | Where-Object { $_ })

  if ($allPaths -contains $Entry) {
    Log '[OK]' "PATH contains: $Entry"
  } else {
    Log '[WARN]' "PATH missing: $Entry"
  }
}

function Assert-Dir([string]$Path, [string]$Label) {
  if (Test-Path -LiteralPath $Path) {
    Log '[OK]' "$Label found: $Path"
  } else {
    Log '[ERROR]' "$Label missing: $Path"
    $script:Failures++
  }
}

function Assert-SdkPackage([string]$SdkManager, [string]$Pkg) {
  $list = & $SdkManager --list_installed 2>$null
  if ($list -match [regex]::Escape($Pkg)) {
    Log '[OK]' "SDK package installed: $Pkg"
  } else {
    Log '[ERROR]' "SDK package missing: $Pkg"
    $script:Failures++
  }
}

function Assert-Avd([string]$AvdManager, [string]$Name) {
  $avdList = & $AvdManager list avd
  if ($avdList -match "Name:\s+$([regex]::Escape($Name))") {
    Log '[OK]' "AVD exists: $Name"
  } else {
    Log '[ERROR]' "AVD missing: $Name"
    $script:Failures++
  }
}

Log '[CHECK]' 'Validating Windows runtime host requirements.'

Assert-Command 'node' | Out-Null
if (Get-Command node -ErrorAction SilentlyContinue) { node --version }

Assert-Command 'npm' | Out-Null
if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version }

Assert-Command 'java' | Out-Null
if (Get-Command java -ErrorAction SilentlyContinue) { java -version }

$sdkmanager = Join-Path $AndroidSdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
$avdmanager = Join-Path $AndroidSdkRoot 'cmdline-tools\latest\bin\avdmanager.bat'
$emulatorExe = Join-Path $AndroidSdkRoot 'emulator\emulator.exe'
$adbExe = Join-Path $AndroidSdkRoot 'platform-tools\adb.exe'
$aaptExe = Join-Path $AndroidSdkRoot 'build-tools\35.0.0\aapt.exe'

Assert-Dir $sdkmanager 'sdkmanager.bat'
Assert-Dir $avdmanager 'avdmanager.bat'
Assert-Dir $emulatorExe 'emulator.exe'
Assert-Dir $adbExe 'adb.exe'
Assert-Dir $aaptExe 'aapt.exe'

Assert-Env -Name 'ANDROID_SDK_ROOT' -Expected $AndroidSdkRoot
Assert-Env -Name 'ANDROID_HOME' -Expected $AndroidSdkRoot

Assert-PathContains (Join-Path $AndroidSdkRoot 'cmdline-tools\latest\bin')
Assert-PathContains (Join-Path $AndroidSdkRoot 'platform-tools')
Assert-PathContains (Join-Path $AndroidSdkRoot 'emulator')
Assert-PathContains (Join-Path $AndroidSdkRoot 'build-tools\35.0.0')

if (Test-Path $sdkmanager) {
  Log '[CHECK]' 'sdkmanager version/list check'
  & $sdkmanager --version
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'platform-tools'
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'emulator'
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'platforms;android-35'
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'build-tools;35.0.0'
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'system-images;android-35;google_apis;x86_64'
  Assert-SdkPackage -SdkManager $sdkmanager -Pkg 'system-images;android-35;google_apis_playstore;x86_64'
}

if (Test-Path $avdmanager) {
  Log '[CHECK]' 'AVD list check'
  & $avdmanager list avd
  Assert-Avd -AvdManager $avdmanager -Name 'Android_Small_Clean_API_35'
  Assert-Avd -AvdManager $avdmanager -Name 'Android_Small_GApps_API_35'
  Assert-Avd -AvdManager $avdmanager -Name 'Android_Standard_Clean_API_35'
  Assert-Avd -AvdManager $avdmanager -Name 'Android_Standard_GApps_API_35'
}

if (Test-Path $emulatorExe) {
  Log '[CHECK]' 'emulator version/list check'
  & $emulatorExe -version
  & $emulatorExe -list-avds
}

if (Test-Path $adbExe) {
  Log '[CHECK]' 'adb version/devices check'
  & $adbExe version
  & $adbExe devices
}

if (Test-Path $aaptExe) {
  Log '[CHECK]' 'aapt availability check'
  & $aaptExe v
}

Log '[WARN]' 'Reminder: if emulator acceleration fails, enable CPU virtualization in BIOS and Windows features: Windows Hypervisor Platform + Virtual Machine Platform.'

if ($script:Failures -gt 0) {
  Log '[ERROR]' "Validation completed with $script:Failures failure(s)."
  exit 1
}

Log '[OK]' 'Validation completed successfully.'
exit 0