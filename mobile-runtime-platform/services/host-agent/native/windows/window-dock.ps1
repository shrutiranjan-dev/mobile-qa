param(
  [string]$Mode = "Dock",
  [string]$Action = "",
  [string]$Serial = "",
  [string]$AvdName = "",
  [int]$X = 0,
  [int]$Y = 0,
  [int]$Width = 430,
  [int]$Height = 760,
  [string]$All = "false"
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class Win32Dock {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
"@

$SW_RESTORE = 9
$SWP_SHOWWINDOW = 0x0040
$HWND_TOP = [IntPtr]::Zero

if ([string]::IsNullOrWhiteSpace($Mode) -and -not [string]::IsNullOrWhiteSpace($Action)) { $Mode = $Action }

function Get-ExtractedPort {
  if ($Serial -match "emulator-(\d+)") { return $Matches[1] }
  if ($Serial -match "(\d{4,5})") { return $Matches[1] }
  return ""
}

function Get-WindowRectObject {
  param([IntPtr]$Hwnd)
  $rect = New-Object Win32Dock+RECT
  if (-not [Win32Dock]::GetWindowRect($Hwnd, [ref]$rect)) { return $null }
  $w = [Math]::Max(0, $rect.Right - $rect.Left)
  $h = [Math]::Max(0, $rect.Bottom - $rect.Top)
  return [pscustomobject]@{ x = $rect.Left; y = $rect.Top; width = $w; height = $h; area = ($w * $h) }
}

function Get-EnumWindowsMap {
  $map = @{}
  $null = [Win32Dock]::EnumWindows({
    param($hWnd, $lParam)
    if (-not [Win32Dock]::IsWindowVisible($hWnd)) { return $true }

    [uint32]$winPid = 0
    [void][Win32Dock]::GetWindowThreadProcessId($hWnd, [ref]$winPid)

    $sb = New-Object System.Text.StringBuilder 1024
    [void][Win32Dock]::GetWindowText($hWnd, $sb, $sb.Capacity)
    $title = $sb.ToString()

    $processName = ""
    try { $processName = (Get-Process -Id $winPid -ErrorAction Stop).ProcessName } catch {}

    $handle = ('0x{0}' -f $hWnd.ToInt64().ToString('X'))
    $map[$handle] = [pscustomobject]@{
      hwnd = $hWnd
      handle = $handle
      title = $title
      processId = [int]$winPid
      processName = $processName
      visible = $true
      bounds = (Get-WindowRectObject -Hwnd $hWnd)
    }
    return $true
  }, [IntPtr]::Zero)
  return $map
}

function Merge-ProcessMainWindows {
  param([hashtable]$Map)
  $procs = Get-Process | Where-Object { $_.MainWindowHandle -and $_.MainWindowHandle -ne 0 }
  foreach ($p in $procs) {
    $hVal = [int64]$p.MainWindowHandle
    $hPtr = [IntPtr]::new($hVal)
    $handle = ('0x{0}' -f $hVal.ToString('X'))
    $title = [string]$p.MainWindowTitle
    $visible = $false
    try { $visible = [Win32Dock]::IsWindowVisible($hPtr) } catch {}

    if ($Map.ContainsKey($handle)) {
      if ([string]::IsNullOrWhiteSpace($Map[$handle].title) -and -not [string]::IsNullOrWhiteSpace($title)) {
        $Map[$handle].title = $title
      }
      if ([string]::IsNullOrWhiteSpace($Map[$handle].processName)) {
        $Map[$handle].processName = [string]$p.ProcessName
      }
      if (-not $Map[$handle].processId) {
        $Map[$handle].processId = [int]$p.Id
      }
      if (-not $Map[$handle].bounds) {
        $Map[$handle].bounds = Get-WindowRectObject -Hwnd $hPtr
      }
      continue
    }

    if (-not $visible) { continue }

    $Map[$handle] = [pscustomobject]@{
      hwnd = $hPtr
      handle = $handle
      title = $title
      processId = [int]$p.Id
      processName = [string]$p.ProcessName
      visible = $true
      bounds = (Get-WindowRectObject -Hwnd $hPtr)
    }
  }
}

function Get-AllVisibleWindows {
  $map = Get-EnumWindowsMap
  Merge-ProcessMainWindows -Map $map
  return @($map.Values)
}

function Should-IncludeCandidate {
  param($w, [string]$port)
  $title = [string]$w.title
  $proc = [string]$w.processName
  if ($proc -match 'qemu|emulator') { return $true }
  if ($title -like '*Android Emulator*') { return $true }
  if ($AvdName -and $title -like "*$AvdName*") { return $true }
  if ($port -and $title -like "*$port*") { return $true }
  return $false
}

function Score-Window {
  param($w, [string]$port)
  $title = [string]$w.title
  $proc = [string]$w.processName
  $hasAvd = $AvdName -and ($title -like "*$AvdName*")
  $hasPort = $port -and ($title -like "*$port*")
  $hasAndroidEmu = $title -like '*Android Emulator*'
  $procQemu = $proc -match 'qemu'
  $procEmu = $proc -match 'emulator'

  if ($hasAvd -and $hasPort) { return 1000 }
  if ($hasAvd) { return 900 }
  if ($hasPort) { return 800 }
  if ($procQemu -and $hasAndroidEmu) { return 700 }
  if ($procQemu) { return 600 }
  if ($procEmu) { return 500 }
  return 0
}

function Project-Window {
  param($w)
  [pscustomobject]@{
    title = [string]$w.title
    processName = [string]$w.processName
    processId = [int]$w.processId
    hwnd = [string]$w.handle
    handle = [string]$w.handle
    visible = [bool]$w.visible
    bounds = $w.bounds
  }
}

function List-Candidates {
  param([bool]$IncludeAll)
  $port = Get-ExtractedPort
  $allWindows = Get-AllVisibleWindows
  if ($IncludeAll) { return @($allWindows | ForEach-Object { Project-Window $_ }) }
  return @($allWindows | Where-Object { Should-IncludeCandidate -w $_ -port $port } | ForEach-Object { Project-Window $_ })
}

function Invoke-Dock {
  $port = Get-ExtractedPort
  $allWindows = Get-AllVisibleWindows
  $candidatesRaw = @($allWindows | Where-Object { Should-IncludeCandidate -w $_ -port $port })

  $ranked = foreach ($w in $candidatesRaw) {
    $score = Score-Window -w $w -port $port
    if ($score -gt 0) {
      $area = 0
      if ($w.bounds -and $w.bounds.area) { $area = [int]$w.bounds.area }
      [pscustomobject]@{ window = $w; score = $score; area = $area }
    }
  }

  $best = $ranked | Sort-Object -Property @{Expression='score';Descending=$true}, @{Expression='area';Descending=$true} | Select-Object -First 1

  if (-not $best) {
    @{
      ok = $false
      reason = 'emulator_window_not_found'
      searched = @{ serial = $Serial; avdName = $AvdName; extractedPort = $port }
      candidates = @($candidatesRaw | ForEach-Object { Project-Window $_ })
    } | ConvertTo-Json -Depth 8 -Compress
    exit 1
  }

  $target = $best.window
  [void][Win32Dock]::ShowWindow($target.hwnd, $SW_RESTORE)
  $ok = [Win32Dock]::SetWindowPos($target.hwnd, $HWND_TOP, $X, $Y, $Width, $Height, $SWP_SHOWWINDOW)
  if (-not $ok) {
    @{ ok = $false; reason = 'set_window_pos_failed'; message = 'Failed to move/resize emulator window.'; windowTitle = $target.title } | ConvertTo-Json -Compress
    exit 1
  }

  @{
    ok = $true
    mode = 'native-dock'
    windowTitle = [string]$target.title
    processName = [string]$target.processName
    processId = [int]$target.processId
    handle = [string]$target.handle
    bounds = @{ x = $X; y = $Y; width = $Width; height = $Height }
  } | ConvertTo-Json -Depth 8 -Compress
}

$normalizedMode = $Mode.ToLower()
if ($normalizedMode -eq 'list') {
  $includeAll = $All -in @('true', 'True', '1', 1, $true)
  @{ ok = $true; windows = (List-Candidates -IncludeAll:$includeAll) } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}

if ($normalizedMode -eq 'dock' -or $normalizedMode -eq 'undock') {
  Invoke-Dock
  exit 0
}

@{ ok = $false; reason = 'invalid_mode'; message = 'Mode must be List, Dock, or Undock.' } | ConvertTo-Json -Compress
exit 1
