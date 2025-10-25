# Set environment variables for original server
$env:OPENAI_API_KEY = "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"
$env:INGEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M"
$env:SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY"
$env:SUPABASE_URL = "https://igzvwbvgvmzvvzoclufx.supabase.co"
$env:OPENROUTER_API_KEY = "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"
$env:VERCEL_AUTOMATION_BYPASS_SECRET = "9f4b2d7a1c8e3f0b6a5d2c1e8f7a4b3"

Write-Host "🔧 Starting ORIGINAL server on port 3001..." -ForegroundColor Green
Write-Host "📡 API endpoint: http://localhost:3001/api/chat" -ForegroundColor Cyan
Write-Host "🔧 Environment variables loaded" -ForegroundColor Yellow
Write-Host "⏹️  Press Ctrl+C to stop" -ForegroundColor Red
Write-Host ""

# Start the original server
node original-server.js
