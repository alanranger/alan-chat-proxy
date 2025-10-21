# Test the live chat widget directly
Write-Host "=== Testing Live Chat Widget ==="

# Test the chat.html page directly
Write-Host "`nTesting Chat HTML Page"
try {
    $htmlResponse = Invoke-WebRequest -Uri "https://alan-chat-proxy.vercel.app/chat.html" -Method GET -TimeoutSec 30
    $htmlContent = $htmlResponse.Content
    
    # Check if the updated article card structure is present
    Write-Host "  Contains 'article-meta': $($htmlContent -like '*article-meta*')"
    Write-Host "  Contains 'article-source': $($htmlContent -like '*article-source*')"
    Write-Host "  Contains 'article-actions': $($htmlContent -like '*article-actions*')"
    Write-Host "  Contains 'article-more-info': $($htmlContent -like '*article-more-info*')"
    
    # Check CSS for black text
    Write-Host "  Contains black text color: $($htmlContent -like '*#0b0f16*')"
    
    # Check if the old structure is still there
    Write-Host "  Contains old 'article-type-badge': $($htmlContent -like '*article-type-badge*')"
    
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}

# Test API response structure
Write-Host "`nTesting API Response Structure"
$headers = @{'Content-Type' = 'application/json'}
$body = '{"query": "what tripod do you recommend", "pageContext": {"pathname": "/test"}}'
try {
    $response = Invoke-WebRequest -Uri "https://alan-chat-proxy.vercel.app/api/chat" -Method POST -Headers $headers -Body $body -TimeoutSec 30
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "  API returns structured.articles: $($data.structured.articles -ne $null)"
    Write-Host "  Articles count: $($data.structured.articles.Count)"
    Write-Host "  First article structure:"
    if ($data.structured.articles.Count -gt 0) {
        $firstArticle = $data.structured.articles[0]
        Write-Host "    Title: $($firstArticle.title)"
        Write-Host "    URL: $($firstArticle.url)"
        Write-Host "    Date: $($firstArticle.date_start)"
        Write-Host "    Kind: $($firstArticle.kind)"
    }
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}


