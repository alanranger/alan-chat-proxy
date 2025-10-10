import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, stage, data } = req.body;

  try {
    const { error } = await supabase
      .from('debug_logs')
      .insert({
        url: url,
        stage: stage,
        data: JSON.stringify(data),
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Debug log insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Debug log error:', error);
    return res.status(500).json({ error: error.message });
  }
}
