# One-time setup: folders, npm deps, config template, 15-min scheduled task.
param(
    [string]$HandoffRoot = $PSScriptRoot,
    [int]$IntervalMinutes = 15
)

$ErrorActionPreference = "Stop"

$questionsDir = "C:\Users\alan\Google Drive\Claude shared resources\Claude Questions for Cursor"
$outputsDir = "C:\Users\alan\Google Drive\Claude shared resources\Cursor Outputs for Claude"
$sharedRoot = "C:\Users\alan\Google Drive\Claude shared resources"
$configDir = "$env:LOCALAPPDATA\claude-cursor-handoff"
$configPath = Join-Path $configDir "config.env"

@($questionsDir, "$questionsDir\processed", $outputsDir, $configDir) | ForEach-Object {
    New-Item -ItemType Directory -Force -Path $_ | Out-Null
}

if (-not (Test-Path $configPath)) {
    @(
        "# Cursor API key for hands-off inbox processing",
        "# Get from: https://cursor.com/dashboard/integrations",
        "CURSOR_API_KEY=PASTE_YOUR_KEY_HERE"
    ) | Set-Content -Path $configPath -Encoding UTF8
}

Push-Location $HandoffRoot
npm install --silent 2>&1 | Out-Null
Pop-Location

$cycleScript = Join-Path $HandoffRoot "Run-HandoffCycle.ps1"
$taskName = "ClaudeCursorHandoff15Min"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$cycleScript`""

$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings `
    -Description "Every $IntervalMinutes min: poll Claude Questions for Cursor inbox and process via Cursor SDK" `
    -Force | Out-Null

& (Join-Path $HandoffRoot "Poll-ClaudeQuestions.ps1") | Out-Null

Write-Host ""
Write-Host "Claude <-> Cursor handoff setup complete"
Write-Host "  Inbox:    $questionsDir"
Write-Host "  Outbox:   $outputsDir"
Write-Host "  Task:     $taskName (every $IntervalMinutes min)"
Write-Host "  API key:  $configPath"
Write-Host ""
Write-Host "NEXT: Edit config.env and replace PASTE_YOUR_KEY_HERE with your Cursor API key."
Write-Host "Manual trigger in Cursor chat: check claude"
