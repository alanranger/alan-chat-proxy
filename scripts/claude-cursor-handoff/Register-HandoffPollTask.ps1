# Re-register the 15-minute handoff task (wrapper for Setup).
& (Join-Path $PSScriptRoot "Setup-ClaudeCursorHandoff.ps1") -IntervalMinutes 15
