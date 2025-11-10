#!/usr/bin/env node
/**
 * Test ingestion of URLs with external JSON-LD schema files
 */

const https = require('https');
const { URL } = require('url');

const ingestToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
const apiUrl = process.env.VERCEL_URL || 'https://alan-chat-proxy.vercel.app';

const urls = [
  'https://www.alanranger.com/blog-on-photography/',
  'https://www.alanranger.com/photographic-workshops-near-me',
  'https://www.alanranger.com/beginners-photography-lessons'
];

async function ingest(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(apiUrl + '/api/ingest');
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ingestToken,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\n✅ ${url}`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Success: ${json.ok || false}`);
          if (json.entities) {
            console.log(`   Entities created/updated: ${json.entities}`);
          }
          if (json.jsonLdFound) {
            console.log(`   JSON-LD found: ${json.jsonLdFound}`);
          }
          if (json.jsonLdCount) {
            console.log(`   JSON-LD objects: ${json.jsonLdCount}`);
          }
          if (json.error) {
            console.log(`   Error: ${json.error}`);
          }
          resolve(json);
        } catch (e) {
          console.log(`\n❌ ${url} - Failed to parse response:`);
          console.log(data.substring(0, 500));
          resolve({ error: 'Parse error', raw: data });
        }
      });
    });

    req.on('error', err => {
      console.error(`\n❌ Error ingesting ${url}:`, err.message);
      reject(err);
    });

    req.write(JSON.stringify({ url }));
    req.end();
  });
}

(async () => {
  console.log('🧪 Testing External JSON-LD Ingestion');
  console.log('='.repeat(80));
  console.log(`Testing ${urls.length} URLs with external JSON-LD schema files\n`);
  
  for (const url of urls) {
    try {
      await ingest(url);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to ingest ${url}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Test complete!');
  console.log('\nNext steps:');
  console.log('1. Check Supabase page_entities table for these URLs');
  console.log('2. Verify Product/Event entities were created from external JSON-LD');
  console.log('3. Check logs for "Fetched and parsed external JSON-LD" messages');
})();

