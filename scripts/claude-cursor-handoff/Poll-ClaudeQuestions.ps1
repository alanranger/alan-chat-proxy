# Poll Claude Questions inbox; refresh handoff manifest (status + response index).
# Safe to run on a schedule. Does NOT call Cursor API.

param(
    [string]$HandoffRoot = $PSScriptRoot,
    [string]$LogDir = "$env:LOCALAPPDATA\claude-cursor-handoff\logs"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$manifestScript = Join-Path $HandoffRoot "update-handoff-manifest.mjs"
if (-not (Test-Path $manifestScript)) {
    Write-Error "Missing update-handoff-manifest.mjs"
}

$out = node $manifestScript 2>&1
$now = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
Add-Content -Path (Join-Path $LogDir "poll.log") -Value "$now $out" -Encoding UTF8
Write-Output $out
