const https = require('https');

async function reingestUrl(url) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ url: url });
    const options = {
      hostname: 'alan-chat-proxy.vercel.app',
      port: 443,
      path: '/api/ingest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': 'Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          console.log(`✅ ${url}: ${result.ok ? 'Success' : 'Failed'} - ${result.entities || 0} entities`);
          resolve(result);
        } catch (e) {
          console.log(`❌ ${url}: Parse error - ${e.message}`);
          console.log('Raw response:', body);
          reject(e);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${url}: Connection error - ${err.message}`);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function reingestLandingServices() {
  console.log('🔄 Re-ingesting landing service pages...');
  console.log('⚠️  Make sure local server is running on port 3000 (npm run dev)\n');

  // URLs from the landing_service_pages CSV that should be re-ingested
  const urls = [
    'https://www.alanranger.com/online-photography-course',
    'https://www.alanranger.com/professional-commercial-photographer-coventry/',
    'https://www.alanranger.com/professional-photographer-near-me/',
    'https://www.alanranger.com/corporate-photography-training/',
    'https://www.alanranger.com/photography-lessons-online-121/',
    'https://www.alanranger.com/fine-art-prints/latest-photography-images/',
    'https://www.alanranger.com/gallery-image-portfolios/',
    'https://www.alanranger.com/my-ethical-policy/',
    'https://www.alanranger.com/about-alan-ranger/',
    'https://www.alanranger.com/photography-tuition-services/',
    'https://www.alanranger.com/free-online-photography-course/',
    'https://www.alanranger.com/photography-courses-coventry/',
    'https://www.alanranger.com/photography-workshops-uk/',
    'https://www.alanranger.com/photography-classes/'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const url of urls) {
    try {
      await reingestUrl(url);
      successCount++;
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failCount++;
      console.log(`Failed to process ${url}: ${error.message}`);
    }
  }

  console.log(`\n✅ Re-ingestion complete!`);
  console.log(`Success: ${successCount}, Failed: ${failCount}`);
}

reingestLandingServices().catch(console.error);
