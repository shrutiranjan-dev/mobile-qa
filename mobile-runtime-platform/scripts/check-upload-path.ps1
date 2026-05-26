[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,
  [string]$DeviceSerial = 'emulator-5554',
  [string]$RuntimeProfile = 'Android_Small_Clean_API_35',
  [switch]$DockerMode
)

$ErrorActionPreference = 'Stop'

function Log([string]$Level, [string]$Message) {
  Write-Host ("{0} {1}" -f $Level, $Message)
}

function Get-Json([string]$Url) {
  return Invoke-RestMethod -Uri $Url -Method Get
}

function Assert-Health([string]$Name, [string]$Url) {
  $resp = Get-Json $Url
  if ($resp.status -ne 'ok') {
    throw "$Name unhealthy at $Url"
  }
  Log '[OK]' "$Name health: $Url"
}

if (-not (Test-Path -LiteralPath $ApkPath)) {
  Log '[ERROR]' "APK file not found: $ApkPath"
  exit 1
}

Log '[CHECK]' 'Validating backend health endpoint...'
try {
  Assert-Health -Name 'backend-api' -Url 'http://localhost:4000/health'
} catch {
  Log '[ERROR]' "backend-api health check failed: $($_.Exception.Message)"
  exit 1
}

Log '[UPLOAD]' "Uploading APK: $ApkPath"
$uploadRaw = & curl.exe -s -X POST -F "apk=@$ApkPath" http://localhost:4000/apps/upload
$uploadResult = $uploadRaw | ConvertFrom-Json

if (-not $uploadResult.appId -or -not $uploadResult.fileName -or -not $uploadResult.apkPath) {
  Log '[ERROR]' "Upload response missing appId/fileName/apkPath. Raw: $uploadRaw"
  exit 1
}

$apkUploadedPath = [string]$uploadResult.apkPath

if (-not [System.IO.Path]::IsPathRooted($apkUploadedPath)) {
  Log '[ERROR]' "apkPath is relative: $apkUploadedPath"
  exit 1
}

if ($apkUploadedPath.Contains('\\')) {
  Log '[ERROR]' "apkPath contains backslashes: $apkUploadedPath"
  exit 1
}

if ($DockerMode -and -not $apkUploadedPath.StartsWith('/app/uploads/')) {
  Log '[ERROR]' "Docker mode requires apkPath to start with /app/uploads/: $apkUploadedPath"
  exit 1
}

Log '[OK]' "Upload path checks passed: $apkUploadedPath"

$runBody = @{
  apkPath = $apkUploadedPath
  deviceSerial = $DeviceSerial
  runtimeProfile = $RuntimeProfile
} | ConvertTo-Json

Log '[RUN]' 'Creating runtime job using upload response apkPath...'
$runResult = Invoke-RestMethod -Uri 'http://localhost:4000/runtime/android/run' -Method Post -ContentType 'application/json' -Body $runBody
$jobId = $runResult.jobId
if (-not $jobId) {
  Log '[ERROR]' 'Run endpoint did not return jobId.'
  exit 1
}
Log '[OK]' "Job created: $jobId"

$terminalStates = @('passed', 'failed', 'blocked')
$status = 'queued'
$reason = ''
$maxPoll = 120
$pollCount = 0

while ($pollCount -lt $maxPoll) {
  Start-Sleep -Seconds 2
  $job = Invoke-RestMethod -Uri "http://localhost:4000/runtime/jobs/$jobId" -Method Get
  $status = [string]$job.status
  $reason = [string]$job.reason
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

if (($status -eq 'failed' -or $status -eq 'blocked') -and ($reason -match 'APK does not exist|apk_missing')) {
  Log '[ERROR]' "Path regression detected: status=$status reason=$reason"
  exit 1
}

$reportUrl = "http://localhost:4000/artifacts/jobs/$jobId/report.json"
$screenshotUrl = "http://localhost:4000/artifacts/jobs/$jobId/screenshots/launch.png"
$logcatUrl = "http://localhost:4000/artifacts/jobs/$jobId/logs/logcat.txt"

Write-Host "jobId: $jobId"
Write-Host "report: $reportUrl"
Write-Host "screenshot: $screenshotUrl"
Write-Host "logcat: $logcatUrl"

Log '[OK]' "Terminal job status: $status"

if ($status -eq 'passed') {
  exit 0
}

exit 1
