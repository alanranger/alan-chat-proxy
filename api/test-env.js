export default function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'NOT_SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT_SET',
    INGEST_TOKEN: process.env.INGEST_TOKEN ? 'SET' : 'NOT_SET'
  };
  
  res.status(200).json({
    message: 'Environment Variables Test',
    envVars,
    timestamp: new Date().toISOString()
  });
}
