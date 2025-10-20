/**
 * Simple local development server for testing the chat API
 * This avoids Vercel dev recursive invocation issues
 */

import 'dotenv/config';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the chat handler
const chatHandler = await import('./api/chat.js');

const PORT = 3000;

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route API requests to the chat handler
  if (req.url === '/api/chat' && req.method === 'POST') {
    try {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          
          // Create a mock response object
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              }
            })
          };
          
          // Call the chat handler
          await chatHandler.default({ body: data }, mockRes);
        } catch (error) {
          console.error('Error processing chat request:', error);
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
    // Serve static files
    try {
      let filePath = req.url === '/' ? '/public/chat.html' : req.url;
      if (filePath.startsWith('/public/')) {
        filePath = filePath.substring(7); // Remove /public prefix
      }
      
      const fullPath = join(__dirname, 'public', filePath);
      const content = readFileSync(fullPath);
      
      // Set appropriate content type
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      } else if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
      
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Local development server running on http://localhost:${PORT}`);
  console.log(`📱 Chat interface: http://localhost:${PORT}/chat.html`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`⏹️  Press Ctrl+C to stop the server`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
