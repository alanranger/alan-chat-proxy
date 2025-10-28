$ErrorActionPreference = 'Stop'

$InputCsv = if ($PSBoundParameters.ContainsKey('InputCsv')) { $InputCsv } else { "CSVSs from website\test quesitons.csv" }
$ApiUrl = if ($PSBoundParameters.ContainsKey('ApiUrl')) { $ApiUrl } else { "https://alan-chat-proxy.vercel.app/api/chat" }

if (!(Test-Path $InputCsv)) {
  Write-Error "Input CSV not found: $InputCsv"
}

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH-mm-ss-fffZ")
if (!(Test-Path "results")) { New-Item -ItemType Directory -Path "results" | Out-Null }
$outPath = Join-Path "results" "comprehensive-followup-results-$timestamp.csv"

$rows = Import-Csv -Path $InputCsv

$headers = "Index,Query,PrevQuery,Intent,Confidence,Events,Products,Articles,Chunks,AnswerLen,Version,DurationMs"
Set-Content -Path $outPath -Value $headers -Encoding UTF8

$i = 0
$prev = ""

try {
  $sw = New-Object System.IO.StreamWriter($outPath, $true, [System.Text.Encoding]::UTF8)
  foreach ($r in $rows) {
    $q = ("" + $r.query).Trim()
    if ([string]::IsNullOrWhiteSpace($q)) { continue }
    $i++

    $body = @{ query = $q; topK = 8 }
    if ($prev -ne '') { $body.previousQuery = $prev }
    $json = $body | ConvertTo-Json -Compress

    try {
      $res = Invoke-RestMethod -Uri $ApiUrl -Method POST -ContentType "application/json" -Body $json
      $ans = $res.answer_markdown
      $conf = if ($res.confidence) { [double]$res.confidence } else { 0 }
      $intent = $res.debug.intent
      $ver = $res.debug.version
      $counts = $res.debug.counts
      $events = if ($counts.events) { $counts.events } else { 0 }
      $products = if ($counts.products) { $counts.products } else { 0 }
      $articles = if ($counts.articles) { $counts.articles } else { 0 }
      $chunks = if ($counts.contentChunks) { $counts.contentChunks } else { 0 }
      $dur = if ($res.meta.duration_ms) { $res.meta.duration_ms } else { 0 }
      $alen = if ($ans) { ($ans | Out-String).Length } else { 0 }

      $line = ($i.ToString()+","+('"'+$q.Replace('"','""')+'"')+","+('"'+$prev.Replace('"','""')+'"')+","+$intent+","+$conf+","+$events+","+$products+","+$articles+","+$chunks+","+$alen+","+$ver+","+$dur)
      $sw.WriteLine($line)
      $prev = $q
    }
    catch {
      $line = ($i.ToString()+","+('"'+$q.Replace('"','""')+'"')+","+('"'+$prev.Replace('"','""')+'"')+",error,0,0,0,0,0,0,err,0")
      $sw.WriteLine($line)
      $prev = $q
    }
  }
}
finally {
  if ($sw) { $sw.Flush(); $sw.Close(); $sw.Dispose() }
}

Write-Output "Wrote results: $outPath"

