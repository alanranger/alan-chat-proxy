import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for RLS bypass
const EXPECTED_TOKEN = process.env.INGEST_TOKEN || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    if (token !== EXPECTED_TOKEN) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get current count before refresh
    const { data: beforeData, error: beforeError } = await supabase
      .from('event_product_links_auto')
      .select('*', { count: 'exact', head: true });

    if (beforeError) {
      console.error('Error getting before count:', beforeError);
      return res.status(500).json({ 
        error: 'Failed to get before count', 
        detail: beforeError.message 
      });
    }

    const beforeCount = beforeData?.length || 0;

    // Call the refresh function directly
    console.log('Calling refresh_event_product_autolinks function...');
    const { data: refreshData, error: refreshError } = await supabase
      .rpc('refresh_event_product_autolinks');

    if (refreshError) {
      console.error('Error calling refresh function:', refreshError);
      return res.status(500).json({ 
        error: 'Failed to refresh mappings', 
        detail: refreshError.message,
        code: refreshError.code,
        hint: refreshError.hint
      });
    }

    console.log('Refresh function completed successfully');

    // Get count after refresh
    const { data: afterData, error: afterError } = await supabase
      .from('event_product_links_auto')
      .select('*', { count: 'exact', head: true });

    if (afterError) {
      console.error('Error getting after count:', afterError);
      return res.status(500).json({ 
        error: 'Failed to get after count', 
        detail: afterError.message 
      });
    }

    const afterCount = afterData?.length || 0;
    const mappingsCreated = afterCount - beforeCount;

    // Get some sample mappings to show what was created
    const { data: sampleMappings, error: sampleError } = await supabase
      .from('event_product_links_auto')
      .select('event_url, product_url, score, method')
      .order('score', { ascending: false })
      .limit(5);

    if (sampleError) {
      console.error('Error getting sample mappings:', sampleError);
    }

    return res.status(200).json({
      ok: true,
      message: 'Event-product mappings refreshed successfully',
      beforeCount,
      afterCount,
      mappingsCreated,
      sampleMappings: sampleMappings || []
    });

  } catch (error) {
    console.error('Unexpected error in refresh-mappings:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      detail: error.message 
    });
  }
}
