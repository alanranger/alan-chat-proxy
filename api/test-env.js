export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const envCheck = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    INGEST_TOKEN: !!process.env.INGEST_TOKEN,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY
  };
  
  return res.status(200).json({
    ok: true,
    environment_variables: envCheck,
    message: "Environment variable check"
  });
}
