# Poll inbox + process pending questions via Cursor SDK (hands-off cycle).
param(
    [string]$HandoffRoot = $PSScriptRoot,
    [string]$ConfigPath = "$env:LOCALAPPDATA\claude-cursor-handoff\config.env",
    [string]$LockPath = "$env:LOCALAPPDATA\claude-cursor-handoff\processing.lock",
    [string]$LogDir = "$env:LOCALAPPDATA\claude-cursor-handoff\logs"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-HandoffLog {
    param([string]$Message)
    $line = "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK') $Message"
    Add-Content -Path (Join-Path $LogDir "cycle.log") -Value $line -Encoding UTF8
    Write-Output $line
}

if (Test-Path $LockPath) {
    $age = (Get-Date) - (Get-Item $LockPath).LastWriteTime
    if ($age.TotalMinutes -lt 45) {
        Write-HandoffLog "skip: lock active ($([math]::Round($age.TotalMinutes,1)) min)"
        exit 0
    }
    Remove-Item $LockPath -Force
}

$pollScript = Join-Path $HandoffRoot "Poll-ClaudeQuestions.ps1"
& $pollScript | Out-Null

$flagPath = "C:\Users\alan\Google Drive\Claude shared resources\Cursor Outputs for Claude\.inbox-has-pending"
if (-not (Test-Path $flagPath)) {
    Write-HandoffLog "ok: no pending questions"
    exit 0
}

$apiKey = $null
if (Test-Path $ConfigPath) {
    Get-Content $ConfigPath | ForEach-Object {
        if ($_ -match '^\s*CURSOR_API_KEY\s*=\s*(.+)\s*$') { $apiKey = $Matches[1].Trim().Trim('"') }
    }
}

if (-not $apiKey -or $apiKey -eq "PASTE_YOUR_KEY_HERE") {
    Write-HandoffLog "pending but skipped: set CURSOR_API_KEY in $ConfigPath"
    exit 0
}

$nodeScript = Join-Path $HandoffRoot "process-inbox.mjs"
if (-not (Test-Path $nodeScript)) {
    Write-HandoffLog "error: missing process-inbox.mjs"
    exit 1
}

Set-Content -Path $LockPath -Value (Get-Date).ToString("o") -Encoding UTF8
try {
    Write-HandoffLog "processing: starting Cursor SDK agent"
    $env:CURSOR_API_KEY = $apiKey
    $repoRoot = Resolve-Path (Join-Path $HandoffRoot "..\..")
    $env:HANDOFF_REPO_ROOT = $repoRoot.Path
    Push-Location $HandoffRoot
    node process-inbox.mjs 2>&1 | ForEach-Object { Write-HandoffLog "agent: $_" }
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { Write-HandoffLog "agent exit code $exit" }
} finally {
    Pop-Location
    if (Test-Path $LockPath) { Remove-Item $LockPath -Force }
    & $pollScript | Out-Null
}

Write-HandoffLog "cycle complete"
