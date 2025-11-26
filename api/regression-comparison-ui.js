// Lightweight HTML wrapper to serve the Regression Test Comparison Tool
// with Supabase URL & anon key prefilled from server env.

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Regression Test Comparison Tool</title>
  <link rel="stylesheet" href="/regression-comparison.html" disabled onload="this.disabled=true" />
</head>
<body>
  <!-- We reuse the already-built static HTML, but bootstrap Supabase config via globals -->
  <script>
    window.__SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
    window.__SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
  </script>
  <iframe src="/regression-comparison.html" style="border:0;width:100%;height:100vh;"></iframe>
</body>
</html>`;

    return res.status(200).send(html);
  } catch (error) {
    console.error('Error rendering regression comparison UI:', error);
    return res
      .status(500)
      .send('<h1>Internal Server Error</h1><p>Unable to render regression comparison UI.</p>');
  }
}


