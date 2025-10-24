import { createServer } from 'http';

// Import the original chat.js as apichat
const { default: chatHandler } = await import('./results/apichat.js');

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    try {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          
          // Mock Express.js-style req and res objects
          const mockReq = {
            method: 'POST',
            body: data,
            headers: {
              'user-agent': 'test-agent',
              'content-type': 'application/json'
            },
            connection: {
              remoteAddress: '127.0.0.1'
            },
            ip: '127.0.0.1'
          };
          
          const mockRes = {
            status: (code) => ({
              json: (data) => {
                res.writeHead(code, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              }
            })
          };
          
          // Let the handler manage the response completely
          await chatHandler(mockReq, mockRes);
        } catch (error) {
          console.error('Original API error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
        }
      });
    } catch (error) {
      console.error('Original API request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🔧 ORIGINAL API server running on port ${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/api/chat`);
});
