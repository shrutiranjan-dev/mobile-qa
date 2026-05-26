[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,
  [string]$DeviceSerial = 'emulator-5554',
  [string]$RuntimeProfile = 'Android_Small_Clean_API_35'
)

$ErrorActionPreference = 'Stop'

function Log([string]$Level, [string]$Message) {
  Write-Host ("{0} {1}" -f $Level, $Message)
}

function Get-Json([string]$Url) {
  return Invoke-RestMethod -Uri $Url -Method Get
}

function Assert-Health([string]$Name, [string]$Url) {
  try {
    $resp = Get-Json $Url
    if ($resp.status -eq 'ok') {
      Log '[OK]' "$Name health: $Url"
    } else {
      Log '[ERROR]' "$Name unhealthy response from $Url"
      throw "$Name unhealthy"
    }
  } catch {
    Log '[ERROR]' "$Name health check failed: $($_.Exception.Message)"
    throw
  }
}

if (-not (Test-Path -LiteralPath $ApkPath)) {
  Log '[ERROR]' "APK file not found: $ApkPath"
  exit 1
}

Log '[CHECK]' 'Validating service health endpoints...'
Assert-Health -Name 'host-agent' -Url 'http://localhost:5050/health'
Assert-Health -Name 'backend-api' -Url 'http://localhost:4000/health'
Assert-Health -Name 'android-worker' -Url 'http://localhost:6060/health'

Log '[CHECK]' 'Checking emulator device list from host-agent...'
$devices = Get-Json 'http://localhost:5050/android/devices'
$targetDevice = $devices.devices | Where-Object { $_.serial -eq $DeviceSerial -and $_.state -eq 'device' }
if (-not $targetDevice) {
  Log '[ERROR]' "Device not ready: $DeviceSerial"
  exit 1
}
if (-not $targetDevice.bootCompleted) {
  Log '[WARN]' "Device found but bootCompleted=false for $DeviceSerial"
}
Log '[OK]' "Device ready: $DeviceSerial"

Log '[UPLOAD]' "Uploading APK: $ApkPath"
$uploadRaw = & curl.exe -s -X POST -F "apk=@$ApkPath" http://localhost:4000/apps/upload
$uploadResult = $uploadRaw | ConvertFrom-Json
if (-not $uploadResult.apkPath) {
  Log '[ERROR]' "Upload did not return apkPath. Raw: $uploadRaw"
  exit 1
}
Log '[OK]' "Upload complete. appId=$($uploadResult.appId)"

$runBody = @{
  apkPath = $uploadResult.apkPath
  deviceSerial = $DeviceSerial
  runtimeProfile = $RuntimeProfile
} | ConvertTo-Json

Log '[RUN]' 'Creating runtime job...'
$runResult = Invoke-RestMethod -Uri 'http://localhost:4000/runtime/android/run' -Method Post -ContentType 'application/json' -Body $runBody
$jobId = $runResult.jobId
if (-not $jobId) {
  Log '[ERROR]' 'Run endpoint did not return jobId.'
  exit 1
}
Log '[OK]' "Job created: $jobId"

$terminalStates = @('passed', 'failed', 'blocked')
$status = 'queued'
$maxPoll = 120
$pollCount = 0

while ($pollCount -lt $maxPoll) {
  Start-Sleep -Seconds 2
  $job = Invoke-RestMethod -Uri "http://localhost:4000/runtime/jobs/$jobId" -Method Get
  $status = $job.status
  Log '[CHECK]' "Job status: $status"
  if ($terminalStates -contains $status) {
    break
  }
  $pollCount++
}

if ($terminalStates -notcontains $status) {
  Log '[ERROR]' 'Job polling timed out.'
  exit 1
}

$reportUrl = "http://localhost:4000/artifacts/jobs/$jobId/report.json"
$screenshotUrl = "http://localhost:4000/artifacts/jobs/$jobId/screenshots/launch.png"
$logcatUrl = "http://localhost:4000/artifacts/jobs/$jobId/logs/logcat.txt"

Log '[OK]' "Terminal job status: $status"
Write-Host "report: $reportUrl"
Write-Host "screenshot: $screenshotUrl"
Write-Host "logcat: $logcatUrl"

try {
  Invoke-WebRequest -Uri $reportUrl -OutFile "$env:TEMP\$jobId-report.json" | Out-Null
  Log '[OK]' 'report.json available'
} catch {
  Log '[ERROR]' 'report.json not reachable'
}

try {
  Invoke-WebRequest -Uri $screenshotUrl -OutFile "$env:TEMP\$jobId-launch.png" | Out-Null
  Log '[OK]' 'launch.png available'
} catch {
  Log '[WARN]' 'launch.png not reachable'
}

try {
  Invoke-WebRequest -Uri $logcatUrl -OutFile "$env:TEMP\$jobId-logcat.txt" | Out-Null
  Log '[OK]' 'logcat.txt available'
} catch {
  Log '[WARN]' 'logcat.txt not reachable'
}

if ($status -eq 'passed') {
  exit 0
}

exit 1