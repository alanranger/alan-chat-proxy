# PowerShell timeout script for testing commands
param(
    [string]$Command,
    [int]$TimeoutSeconds = 30
)

Write-Host "⏱️ Running command with $TimeoutSeconds s timeout: $Command"

$job = Start-Job -ScriptBlock {
    param($cmd)
    Invoke-Expression $cmd
} -ArgumentList $Command

$result = Wait-Job $job -Timeout $TimeoutSeconds

if ($result) {
    Write-Host "✅ Command completed successfully"
    Receive-Job $job
    Remove-Job $job
} else {
    Write-Host "⏰ Command timed out after $TimeoutSeconds s, stopping job..."
    Stop-Job $job
    Remove-Job $job
    exit 1
}
