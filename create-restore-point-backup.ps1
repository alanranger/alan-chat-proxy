# Create Restore Point Backup Script
# This script creates backups of all critical working files

Write-Host "🎯 Creating Restore Point Backup for v1.0-courses-workshops-working..." -ForegroundColor Green

# Create backup directory
$backupDir = "backup\restore-point-v1.0"
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
    Write-Host "✅ Created backup directory: $backupDir" -ForegroundColor Green
}

# Backup critical files
$filesToBackup = @(
    "api\chat.js",
    "api\ingest.js", 
    "lib\htmlExtractor.js",
    "public\chat.html",
    "Architecture and Handover\SYSTEM_ARCHITECTURE.md",
    "Architecture and Handover\MIGRATION_GUIDE.md"
)

foreach ($file in $filesToBackup) {
    if (Test-Path $file) {
        $backupFile = "$backupDir\$($file.Replace('\', '_').Replace('/', '_'))"
        Copy-Item $file $backupFile -Force
        Write-Host "✅ Backed up: $file" -ForegroundColor Green
    } else {
        Write-Host "⚠️  File not found: $file" -ForegroundColor Yellow
    }
}

# Create restore instructions
$restoreInstructions = @"
# RESTORE INSTRUCTIONS for v1.0-courses-workshops-working

## To restore from this backup:

1. Copy files back to their original locations:
   - chat_js -> api\chat.js
   - ingest_js -> api\ingest.js
   - htmlExtractor_js -> lib\htmlExtractor.js
   - chat_html -> public\chat.html
   - SYSTEM_ARCHITECTURE_md -> Architecture and Handover\SYSTEM_ARCHITECTURE.md
   - MIGRATION_GUIDE_md -> Architecture and Handover\MIGRATION_GUIDE.md

2. Or use git to restore:
   git checkout v1.0-courses-workshops-working

## What this restore point includes:
- ✅ Working product cards with all structured data
- ✅ Fixed location address and time/duration extraction  
- ✅ Clean product card styling
- ✅ Vercel cache management
- ✅ Updated documentation
- ✅ Database records with correct values

Created: $(Get-Date)
"@

$restoreInstructions | Out-File -FilePath "$backupDir\RESTORE_INSTRUCTIONS.txt" -Encoding UTF8

Write-Host "✅ Restore point backup completed!" -ForegroundColor Green
Write-Host "📁 Backup location: $backupDir" -ForegroundColor Cyan
Write-Host "🏷️  Git tag: v1.0-courses-workshops-working" -ForegroundColor Cyan

