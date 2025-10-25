// Set environment variables
process.env.OPENAI_API_KEY = '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';
process.env.INGEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2Nzc5MjgsImV4cCI6MjA3MzI1MzkyOH0.A9TCmnXKJhDRYBkrO0mAMPiUQeV9enweeyRWKWQ1SZY';
process.env.SUPABASE_URL = 'https://igzvwbvgvmzvvzoclufx.supabase.co';
process.env.OPENROUTER_API_KEY = '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';
process.env.VERCEL_AUTOMATION_BYPASS_SECRET = '9f4b2d7a1c8e3f0b6a5d2c1e8f7a4b3';

// Import the handler from api/chat.js
import handler from './api/chat.js';

// Create a simple HTTP server
import http from 'http';

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Only handle POST requests to /api/chat
  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      // Parse request body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const parsedBody = JSON.parse(body);
          
          // Create mock request object with all required properties
          const mockReq = {
            method: 'POST',
            body: parsedBody,
            headers: req.headers,
            url: req.url,
            connection: {
              remoteAddress: req.connection?.remoteAddress || '127.0.0.1'
            },
            ip: req.connection?.remoteAddress || '127.0.0.1'
          };
          
          // Create mock response object
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              }
            }),
            json: (data) => {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            }
          };
          
          // Call the handler
          await handler(mockReq, mockRes);
        } catch (error) {
          console.error('Error processing request:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    } catch (error) {
      console.error('Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📡 API endpoint: http://localhost:3000/api/chat');
  console.log('🔧 Environment variables loaded');
  console.log('⏹️  Press Ctrl+C to stop');
});
