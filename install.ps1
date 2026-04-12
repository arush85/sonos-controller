#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Sonos Controller — Windows Installer
.DESCRIPTION
    Installs dependencies, builds the app, and sets up Windows scheduled tasks
    so the controller and Sonos API run automatically at boot.
.NOTES
    Run from an elevated PowerShell prompt:
      Set-ExecutionPolicy Bypass -Scope Process -Force
      .\install.ps1
#>

$ErrorActionPreference = "Stop"
$InstallDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Ok($msg)   { Write-Host "  [OK] $msg"   -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!]  $msg"   -ForegroundColor Yellow }
function Write-Step($msg) { Write-Host "`n  >>  $msg`n" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "  [X] $msg"    -ForegroundColor Red; exit 1 }

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

Write-Host ""
Write-Host "  Sonos Controller -- Windows Installer" -ForegroundColor White
Write-Host "  ----------------------------------------" -ForegroundColor White
Write-Host ""
Write-Ok "Install directory: $InstallDir"

# ── Prerequisites ─────────────────────────────────────────────────────────────

Write-Step "Checking prerequisites"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn "Node.js not found. Installing via winget..."
    winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    Refresh-Path
}

try {
    $nodeMajor = [int](node -e "console.log(parseInt(process.version.slice(1)))" 2>$null)
    if ($nodeMajor -lt 18) { Write-Fail "Node.js v18+ required. Run: winget upgrade OpenJS.NodeJS.LTS" }
} catch { Write-Fail "Could not determine Node.js version. Ensure Node.js v18+ is installed." }

Write-Ok "Node.js $(node -v)"
$NodePath = (Get-Command node).Source

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warn "git not found. Installing via winget..."
    winget install Git.Git --silent --accept-source-agreements --accept-package-agreements
    Refresh-Path
}

Write-Ok "git"

# ── Build ─────────────────────────────────────────────────────────────────────

Write-Step "Installing dependencies and building the app"

Set-Location $InstallDir
npm install
npm run build

Write-Ok "Build complete -- output in dist\"

# ── node-sonos-http-api ───────────────────────────────────────────────────────

Write-Step "Setting up node-sonos-http-api"

$ApiDir = Join-Path $InstallDir "node-sonos-http-api"

if (Test-Path $ApiDir) {
    Write-Ok "node-sonos-http-api already present, skipping clone"
} else {
    git clone https://github.com/jishi/node-sonos-http-api.git $ApiDir
    Set-Location $ApiDir
    npm install --omit=dev
    Set-Location $InstallDir
    Write-Ok "node-sonos-http-api installed"
}

# ── Config ────────────────────────────────────────────────────────────────────

Write-Step "Configuring your Sonos connection"

Write-Host "  Your Sonos room name is shown in the Sonos app -- tap the speaker name to find it."
Write-Host "  It is case-sensitive (e.g. 'Living Room' not 'living room')."
Write-Host ""

$RoomName = ""
while (-not $RoomName) {
    $RoomName = Read-Host "  Room name"
    if (-not $RoomName) { Write-Warn "Room name cannot be empty." }
}

$ApiPort = Read-Host "  Sonos API port [5005]"
if (-not $ApiPort) { $ApiPort = "5005" }

$CtrlPort = Read-Host "  Controller port [3000]"
if (-not $CtrlPort) { $CtrlPort = "3000" }

$configJson = @{
    "sonos-config" = @{
        host = "localhost"
        port = $ApiPort
        room = $RoomName
    }
} | ConvertTo-Json -Depth 3

Set-Content -Path (Join-Path $InstallDir "sonos-data.json") -Value $configJson
Write-Ok "Config saved to sonos-data.json"

# ── Wrapper scripts ───────────────────────────────────────────────────────────
# Task Scheduler can't set env vars inline, so we generate small launcher scripts.
# These are gitignored — they contain machine-specific paths.

$apiLauncher = Join-Path $InstallDir "start-api.ps1"
Set-Content -Path $apiLauncher -Value @"
`$env:PORT = '$ApiPort'
& '$NodePath' '$ApiDir\server.js'
"@

$ctrlLauncher = Join-Path $InstallDir "start-ctrl.ps1"
Set-Content -Path $ctrlLauncher -Value @"
`$env:PORT = '$CtrlPort'
& '$NodePath' '$InstallDir\server.js'
"@

# ── Scheduled tasks ───────────────────────────────────────────────────────────

Write-Step "Setting up background services (Windows Task Scheduler)"

$trigger  = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances    IgnoreNew `
    -RestartCount         999 `
    -RestartInterval      (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit   ([TimeSpan]::Zero)

$psArgs = "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File"

$apiAction  = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "$psArgs `"$apiLauncher`"" `
    -WorkingDirectory $ApiDir

$ctrlAction = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "$psArgs `"$ctrlLauncher`"" `
    -WorkingDirectory $InstallDir

# Remove existing tasks if reinstalling
foreach ($name in @("SonosAPI", "SonosController")) {
    if (Get-ScheduledTask -TaskPath "\Sonos\" -TaskName $name -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask  -TaskPath "\Sonos" -TaskName $name -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskPath "\Sonos\" -TaskName $name -Confirm:$false
    }
}

Register-ScheduledTask -TaskName "SonosAPI" -TaskPath "\Sonos" `
    -Trigger $trigger -Action $apiAction -Settings $settings -Principal $principal -Force | Out-Null

Register-ScheduledTask -TaskName "SonosController" -TaskPath "\Sonos" `
    -Trigger $trigger -Action $ctrlAction -Settings $settings -Principal $principal -Force | Out-Null

Write-Ok "Scheduled tasks created under Task Scheduler > \Sonos\"

# ── Start immediately ─────────────────────────────────────────────────────────

Write-Step "Starting services"

Start-ScheduledTask -TaskPath "\Sonos" -TaskName "SonosAPI"
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskPath "\Sonos" -TaskName "SonosController"

Write-Ok "Services started"

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  All done!" -ForegroundColor Green
Write-Host ""
Write-Host "  Sonos API:   http://localhost:$ApiPort"  -ForegroundColor White
Write-Host "  Controller:  http://localhost:$CtrlPort" -ForegroundColor White
Write-Host ""
Write-Host "  Both services start automatically at boot."
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    Open Task Scheduler:   taskschd.msc"
Write-Host "    Restart controller:    Restart-ScheduledTask -TaskPath '\Sonos' -TaskName 'SonosController'"
Write-Host "    Restart API:           Restart-ScheduledTask -TaskPath '\Sonos' -TaskName 'SonosAPI'"
Write-Host "    Stop all:              Get-ScheduledTask -TaskPath '\Sonos\' | Stop-ScheduledTask"
Write-Host "    View logs:             Get-EventLog -LogName System -Source 'Task Scheduler' -Newest 20"
Write-Host ""
