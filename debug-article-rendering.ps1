# Debug article rendering by testing the actual chat interface
Write-Host "=== Debugging Article Rendering ==="

# Test the chat.html page and look for any JavaScript errors or issues
Write-Host "`nTesting Chat HTML for Article Rendering"
try {
    $htmlResponse = Invoke-WebRequest -Uri "https://alan-chat-proxy.vercel.app/chat.html" -Method GET -TimeoutSec 30
    $htmlContent = $htmlResponse.Content
    
    # Check if the renderArticlesBlock function exists
    Write-Host "  Contains 'renderArticlesBlock': $($htmlContent -like '*renderArticlesBlock*')"
    
    # Check if the pickArticles function exists  
    Write-Host "  Contains 'pickArticles': $($htmlContent -like '*pickArticles*')"
    
    # Check if the article card HTML structure is correct
    Write-Host "  Contains 'article-meta' in HTML: $($htmlContent -like '*article-meta*')"
    Write-Host "  Contains 'article-source' in HTML: $($htmlContent -like '*article-source*')"
    
    # Check for any console.log statements that might help debug
    Write-Host "  Contains console.log statements: $($htmlContent -like '*console.log*')"
    
    # Check if there are any syntax errors in the JavaScript
    $jsStart = $htmlContent.IndexOf('<script>')
    $jsEnd = $htmlContent.LastIndexOf('</script>')
    if ($jsStart -gt 0 -and $jsEnd -gt $jsStart) {
        $jsContent = $htmlContent.Substring($jsStart, $jsEnd - $jsStart)
        Write-Host "  JavaScript section found: $($jsContent.Length) characters"
        
        # Check for the specific article rendering code
        Write-Host "  Contains article card HTML template: $($jsContent -like '*article-card*')"
        Write-Host "  Contains article-meta template: $($jsContent -like '*article-meta*')"
    }
    
} catch {
    Write-Host "  Error: $($_.Exception.Message)"
}


