const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const QUERIES = [
  "do you offer gift vouchers",
  "how do I focus in landscape photography",
  "how do I improve my photography",
  "how do I photograph autumn colours",
  "how do I photograph bluebells",
  "how do I photograph flowers",
  "how do I photograph people",
  "how do I photograph seascapes",
  "how do I photograph sunsets",
  "how do I photograph waterfalls",
  "how do I photograph wildlife",
  "how do I take better landscape photos",
  "how do I use a tripod",
  "How long are your workshops?",
  "How much is a residential photography course and does it include B&B",
  "what camera should I buy",
  "what is a histogram",
  "what is aperture",
  "what is composition in photography",
  "what is depth of field",
  "what is golden hour",
  "what is HDR photography",
  "what is ISO",
  "what is long exposure photography",
  "what is macro photography",
  "what is portrait photography",
  "what is shutter speed",
  "what is the best camera for beginners",
  "what is the best lens for landscape photography",
  "what is the best time of day for landscape photography",
  "what is the difference between prime and zoom lenses",
  "what is the rule of thirds",
  "what is your cancellation policy",
  "what is your next workshop date and where is it",
  "what memory card should I buy",
  "what settings should I use for landscape photography",
  "what tripod should I buy",
  "when are your next Autumn workshops and where are they?",
  "when is the next devon workshop",
  "whens the next bluebell workshops and whats the cost"
];

function extractContentCounts(structured) {
  return {
    articles: structured?.articles?.length || 0,
    services: structured?.services?.length || 0,
    events: structured?.events?.length || 0,
    products: structured?.products?.length || 0
  };
}

function getTopItems(structured, type, limit = 3) {
  const items = structured?.[type] || [];
  return items.slice(0, limit).map(item => {
    const id = item.id || item.raw?.id || 'N/A';
    const title = item.title || item.raw?.name || item.event_title || item.product_title || 'N/A';
    return { id, title };
  });
}

function determineStatus(baseline, current) {
  const baselineTotal = baseline.articles + baseline.services + baseline.events + baseline.products;
  const currentTotal = current.articles + current.services + current.events + current.products;
  
  // Check if content types match
  const articlesMatch = baseline.articles === current.articles;
  const servicesMatch = baseline.services === current.services;
  const eventsMatch = baseline.events === current.events;
  const productsMatch = baseline.products === current.products;
  
  if (baselineTotal === 0 && currentTotal === 0) return 'same';
  if (baselineTotal === 0 && currentTotal > 0) return 'better';
  if (baselineTotal > 0 && currentTotal === 0) return 'worse';
  
  // Check if top article changed (for article-heavy queries)
  const baselineTopArticle = baseline.topArticles[0];
  const currentTopArticle = current.topArticles[0];
  const topArticleChanged = baselineTopArticle && currentTopArticle && 
    baselineTopArticle.id !== currentTopArticle.id;
  
  // Simple heuristic: if total increased and types are similar, better
  // If total decreased significantly, worse
  // If top article changed but total similar, mixed
  if (currentTotal > baselineTotal * 1.2 && articlesMatch && servicesMatch) return 'better';
  if (currentTotal < baselineTotal * 0.8) return 'worse';
  if (topArticleChanged && Math.abs(currentTotal - baselineTotal) <= 2) return 'mixed';
  if (articlesMatch && servicesMatch && eventsMatch && productsMatch) return 'same';
  
  return 'mixed';
}

async function generateTable() {
  // Fetch baseline results
  const { data: baselineData, error: baselineError } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', 878)
    .single();
  
  if (baselineError || !baselineData) {
    console.error('Error fetching baseline:', baselineError);
    return;
  }
  
  // Fetch current results
  const { data: currentData, error: currentError } = await supabase
    .from('regression_test_results')
    .select('results')
    .eq('id', 936)
    .single();
  
  if (currentError || !currentData) {
    console.error('Error fetching current:', currentError);
    return;
  }
  
  const baselineResults = baselineData.results || [];
  const currentResults = currentData.results || [];
  
  // Create maps for quick lookup
  const baselineMap = new Map();
  baselineResults.forEach(r => {
    if (r.query) baselineMap.set(r.query.toLowerCase(), r);
  });
  
  const currentMap = new Map();
  currentResults.forEach(r => {
    if (r.query) currentMap.set(r.query.toLowerCase(), r);
  });
  
  // Process each query
  const rows = [];
  let betterCount = 0, worseCount = 0, mixedCount = 0, sameCount = 0;
  
  QUERIES.forEach((query, idx) => {
    const qNum = idx + 1;
    const baseline = baselineMap.get(query.toLowerCase());
    const current = currentMap.get(query.toLowerCase());
    
    if (!baseline || !current) {
      console.warn(`Missing data for query ${qNum}: ${query}`);
      return;
    }
    
    const baselineCounts = extractContentCounts(baseline.response?.structured);
    const currentCounts = extractContentCounts(current.response?.structured);
    
    const baselineTopArticles = getTopItems(baseline.response?.structured, 'articles', 1);
    const baselineTopServices = getTopItems(baseline.response?.structured, 'services', 1);
    const baselineTopEvents = getTopItems(baseline.response?.structured, 'events', 1);
    
    const currentTopArticles = getTopItems(current.response?.structured, 'articles', 1);
    const currentTopServices = getTopItems(current.response?.structured, 'services', 1);
    const currentTopEvents = getTopItems(current.response?.structured, 'events', 1);
    
    const status = determineStatus(
      { ...baselineCounts, topArticles: baselineTopArticles },
      { ...currentCounts, topArticles: currentTopArticles }
    );
    
    if (status === 'better') betterCount++;
    else if (status === 'worse') worseCount++;
    else if (status === 'mixed') mixedCount++;
    else sameCount++;
    
    rows.push({
      qNum,
      query,
      baseline: {
        counts: baselineCounts,
        topArticles: baselineTopArticles,
        topServices: baselineTopServices,
        topEvents: baselineTopEvents
      },
      current: {
        counts: currentCounts,
        topArticles: currentTopArticles,
        topServices: currentTopServices,
        topEvents: currentTopEvents
      },
      status
    });
  });
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Question-by-Question Breakdown: Baseline vs Current</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            max-width: 1400px;
            margin: 0 auto;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #333;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
            margin-top: 30px;
            border-bottom: 2px solid #ddd;
            padding-bottom: 5px;
        }
        .overview {
            background-color: #f9f9f9;
            padding: 15px;
            border-left: 4px solid #333;
            margin: 20px 0;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background-color: white;
        }
        .summary-table th,
        .summary-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        .summary-table th {
            background-color: #333;
            color: white;
            font-weight: bold;
        }
        .summary-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 12px;
        }
        .comparison-table th {
            background-color: #333;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #555;
        }
        .comparison-table td {
            border: 1px solid #ddd;
            padding: 10px 8px;
            vertical-align: top;
        }
        .comparison-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .comparison-table tr:hover {
            background-color: #f0f0f0;
        }
        .query-col {
            font-weight: bold;
            width: 15%;
        }
        .baseline-col,
        .current-col {
            width: 25%;
        }
        .status-col {
            width: 8%;
            text-align: center;
        }
        .notes-col {
            width: 27%;
        }
        .status-better {
            color: #28a745;
            font-weight: bold;
        }
        .status-worse {
            color: #dc3545;
            font-weight: bold;
        }
        .status-mixed {
            color: #ffc107;
            font-weight: bold;
        }
        .status-same {
            color: #6c757d;
            font-weight: bold;
        }
        .content-line {
            margin: 4px 0;
            line-height: 1.4;
        }
        .content-type {
            font-weight: 600;
        }
        @media print {
            body {
                background-color: white;
                margin: 0;
            }
            .container {
                box-shadow: none;
                padding: 20px;
            }
            .comparison-table {
                font-size: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Question-by-Question Breakdown: Baseline vs Current</h1>
        
        <div class="overview">
            <strong>Overview</strong><br>
            <strong>Baseline Test:</strong> #878 (2025-11-21)<br>
            <strong>Current Test:</strong> #936 (2025-11-25)<br>
            <strong>Total Queries:</strong> 40
        </div>

        <h2>Summary Counts</h2>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>✅ <strong>Better</strong></td>
                    <td>${betterCount}</td>
                    <td>${(betterCount / 40 * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>❌ <strong>Worse</strong></td>
                    <td>${worseCount}</td>
                    <td>${(worseCount / 40 * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>⚠️ <strong>Mixed</strong></td>
                    <td>${mixedCount}</td>
                    <td>${(mixedCount / 40 * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                    <td>➖ <strong>Same</strong></td>
                    <td>${sameCount}</td>
                    <td>${(sameCount / 40 * 100).toFixed(1)}%</td>
                </tr>
            </tbody>
        </table>

        <h2>Detailed Comparison Table</h2>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th class="query-col">Query</th>
                    <th class="baseline-col">Baseline (type: count, top item)</th>
                    <th class="current-col">Current (type: count, top item)</th>
                    <th class="status-col">Status</th>
                    <th class="notes-col">Notes</th>
                </tr>
            </thead>
            <tbody>
${rows.map(row => {
  const statusClass = `status-${row.status}`;
  const statusIcon = row.status === 'better' ? '✅' : row.status === 'worse' ? '❌' : row.status === 'mixed' ? '⚠️' : '➖';
  
  const baselineText = [
    row.baseline.counts.articles > 0 ? `<div class="content-line"><span class="content-type">Articles:</span> ${row.baseline.counts.articles}${row.baseline.topArticles[0] ? ` ("${row.baseline.topArticles[0].title.substring(0, 60)}${row.baseline.topArticles[0].title.length > 60 ? '...' : ''}" ID:${row.baseline.topArticles[0].id})` : ''}</div>` : '',
    row.baseline.counts.services > 0 ? `<div class="content-line"><span class="content-type">Services:</span> ${row.baseline.counts.services}${row.baseline.topServices[0] ? ` ("${row.baseline.topServices[0].title.substring(0, 60)}${row.baseline.topServices[0].title.length > 60 ? '...' : ''}" ID:${row.baseline.topServices[0].id})` : ''}</div>` : '',
    row.baseline.counts.events > 0 ? `<div class="content-line"><span class="content-type">Events:</span> ${row.baseline.counts.events}${row.baseline.topEvents[0] ? ` ("${row.baseline.topEvents[0].title.substring(0, 60)}${row.baseline.topEvents[0].title.length > 60 ? '...' : ''}")` : ''}</div>` : ''
  ].filter(Boolean).join('') || '<div class="content-line"><em>(No content)</em></div>';
  
  const currentText = [
    row.current.counts.articles > 0 ? `<div class="content-line"><span class="content-type">Articles:</span> ${row.current.counts.articles}${row.current.topArticles[0] ? ` ("${row.current.topArticles[0].title.substring(0, 60)}${row.current.topArticles[0].title.length > 60 ? '...' : ''}" ID:${row.current.topArticles[0].id})` : ''}</div>` : '',
    row.current.counts.services > 0 ? `<div class="content-line"><span class="content-type">Services:</span> ${row.current.counts.services}${row.current.topServices[0] ? ` ("${row.current.topServices[0].title.substring(0, 60)}${row.current.topServices[0].title.length > 60 ? '...' : ''}" ID:${row.current.topServices[0].id})` : ''}</div>` : '',
    row.current.counts.events > 0 ? `<div class="content-line"><span class="content-type">Events:</span> ${row.current.counts.events}${row.current.topEvents[0] ? ` ("${row.current.topEvents[0].title.substring(0, 60)}${row.current.topEvents[0].title.length > 60 ? '...' : ''}")` : ''}</div>` : ''
  ].filter(Boolean).join('') || '<div class="content-line"><em>(No content)</em></div>';
  
  const notes = generateNotes(row);
  
  return `                <tr>
                    <td class="query-col"><strong>Q${row.qNum}. ${row.query}</strong></td>
                    <td>${baselineText}</td>
                    <td>${currentText}</td>
                    <td class="status-col ${statusClass}">${statusIcon} <strong>${row.status.charAt(0).toUpperCase() + row.status.slice(1)}</strong></td>
                    <td>${notes}</td>
                </tr>`;
}).join('\n')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

  return html;
}

function generateNotes(row) {
  const notes = [];
  
  if (row.baseline.counts.articles !== row.current.counts.articles) {
    notes.push(`Articles: ${row.baseline.counts.articles} → ${row.current.counts.articles}`);
  }
  if (row.baseline.counts.services !== row.current.counts.services) {
    notes.push(`Services: ${row.baseline.counts.services} → ${row.current.counts.services}`);
  }
  if (row.baseline.counts.events !== row.current.counts.events) {
    notes.push(`Events: ${row.baseline.counts.events} → ${row.current.counts.events}`);
  }
  
  if (row.baseline.topArticles[0] && row.current.topArticles[0] && 
      row.baseline.topArticles[0].id !== row.current.topArticles[0].id) {
    notes.push(`Top article changed`);
  }
  
  return notes.length > 0 ? notes.join('; ') : 'No significant changes';
}

async function main() {
  try {
    const html = await generateTable();
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(__dirname, 'QUESTION-BY-QUESTION-BREAKDOWN-936.html');
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`✅ HTML table generated: ${outputPath}`);
  } catch (error) {
    console.error('Error generating table:', error);
    process.exit(1);
  }
}

main();

