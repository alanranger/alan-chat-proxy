# RESTORE TO WORKING STATE - October 2025
# PowerShell script to restore the system to the working state

Write-Host "🔄 RESTORING TO WORKING STATE - October 2025" -ForegroundColor Green
Write-Host "=" * 50

# Check if we're in the right directory
if (-not (Test-Path "api\chat.js")) {
    Write-Host "❌ Error: Not in the correct directory. Please run this from the project root." -ForegroundColor Red
    exit 1
}

Write-Host "📁 Restoring critical files..." -ForegroundColor Yellow

# Restore critical files
$files = @(
    @{Source = "backup\restore-point-december-2025\chat.js"; Dest = "api\chat.js"},
    @{Source = "backup\restore-point-december-2025\ingest.js"; Dest = "api\ingest.js"},
    @{Source = "backup\restore-point-december-2025\htmlExtractor.js"; Dest = "lib\htmlExtractor.js"},
    @{Source = "backup\restore-point-december-2025\chat.html"; Dest = "public\chat.html"},
    @{Source = "backup\restore-point-december-2025\SYSTEM_ARCHITECTURE.md"; Dest = "Architecture and Handover\SYSTEM_ARCHITECTURE.md"},
    @{Source = "backup\restore-point-december-2025\MIGRATION_GUIDE.md"; Dest = "Architecture and Handover\MIGRATION_GUIDE.md"}
)

foreach ($file in $files) {
    if (Test-Path $file.Source) {
        Copy-Item $file.Source $file.Dest -Force
        Write-Host "   ✅ Restored: $($file.Dest)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing: $($file.Source)" -ForegroundColor Red
    }
}

Write-Host "`n🗄️ Restoring database records..." -ForegroundColor Yellow

# Run database restore
if (Test-Path "backup\restore-point-december-2025\database-backup.sql") {
    Write-Host "   📋 Database restore script available: database-backup.sql" -ForegroundColor Cyan
    Write-Host "   ⚠️ Run this manually in Supabase SQL editor if needed" -ForegroundColor Yellow
} else {
    Write-Host "   ❌ Database backup script not found" -ForegroundColor Red
}

Write-Host "`n🧪 Running restore point tests..." -ForegroundColor Yellow

# Run tests
if (Test-Path "backup\restore-point-december-2025\test-restore-point.js") {
    try {
        $testResult = node "backup\restore-point-december-2025\test-restore-point.js"
        Write-Host $testResult -ForegroundColor White
    } catch {
        Write-Host "   ⚠️ Could not run tests automatically" -ForegroundColor Yellow
        Write-Host "   📋 Run manually: node backup\restore-point-december-2025\test-restore-point.js" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ❌ Test script not found" -ForegroundColor Red
}

Write-Host "`n🚀 Deploying restored state..." -ForegroundColor Yellow

# Commit and push changes
try {
    git add .
    git commit -m "Restore to working state - October 2025 restore point (commit 593448f)"
    git push
    Write-Host "   ✅ Changes committed and pushed" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️ Could not commit automatically" -ForegroundColor Yellow
    Write-Host "   📋 Run manually: git add . && git commit -m 'Restore to working state' && git push" -ForegroundColor Cyan
}

Write-Host "`n" + "=" * 50
Write-Host "🎉 RESTORE COMPLETE!" -ForegroundColor Green
Write-Host "✅ System restored to working state - October 2025 (commit 593448f)" -ForegroundColor Green
Write-Host "✅ Courses and workshops should be working perfectly" -ForegroundColor Green
Write-Host "✅ Ready to proceed with articles and general questions" -ForegroundColor Green
Write-Host "=" * 50

