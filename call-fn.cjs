#!/usr/bin/env node
const https = require('https');

function usage() {
  console.error('Usage: node call-fn.cjs <path> [method] [jsonBody]');
  console.error('Example: node call-fn.cjs /verify-token POST {"test":"ping"}');
  process.exit(1);
}

const [, , rawPath, rawMethod = 'POST', rawBody] = process.argv;
if (!rawPath) usage();

const token = process.env.FUNCTION_TOKEN;
if (!token) {
  console.error('FUNCTION_TOKEN env var not set');
  process.exit(1);
}

const body = rawBody || '{}';
const projectRef = process.env.SUPABASE_PROJECT_REF || 'igzvwbvgvmzvvzoclufx';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const pathWithQuery = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

const options = {
  hostname: 'igzvwbvgvmzvvzoclufx.functions.supabase.co',
  port: 443,
  path: pathWithQuery,
  method: rawMethod.toUpperCase(),
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Function-Token': token,
    // Standard Supabase headers for anon auth
    ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    const out = {
      status: res.statusCode,
      headers: res.headers,
      body: data,
    };
    console.log(JSON.stringify(out, null, 2));
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();


