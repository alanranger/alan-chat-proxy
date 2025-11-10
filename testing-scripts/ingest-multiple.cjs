const https = require('https');
const url = require('url');

const API_URL = process.env.VERCEL_URL || 'https://alan-chat-proxy.vercel.app';
const INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';

const urls = [
  'https://www.alanranger.com/blog-on-photography/',
  'https://www.alanranger.com/photo-workshops-uk/lake-district-photography-workshop',
  'https://www.alanranger.com/photography-services-near-me',
  'https://www.alanranger.com/photographic-workshops-near-me',
  'https://www.alanranger.com/beginners-photography-lessons'
];

function ingest(targetUrl) {
  return new Promise((resolve) => {
    const parsed = url.parse(API_URL + '/api/ingest');
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.path,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + INGEST_TOKEN,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\n✅ ${targetUrl}`);
          console.log(JSON.stringify(json, null, 2));
        } catch (e) {
          console.log(`\n📄 ${targetUrl} raw response:`);
          console.log(data.slice(0, 500));
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`\n❌ ${targetUrl} error: ${err.message}`);
      resolve();
    });

    req.write(JSON.stringify({ url: targetUrl }));
    req.end();
  });
}

(async () => {
  for (const targetUrl of urls) {
    await ingest(targetUrl);
  }
})();
