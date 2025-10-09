import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const sendJSON = (res, status, data) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).json(data);
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    if (req.method === 'POST') {
      // Submit feedback
      const {
        query,
        responseId,
        rating,
        reason,
        userFeedbackText,
        confidenceScore,
        intent,
        sessionId,
        userAgent,
        pageUrl
      } = req.body;

      if (!query || !rating) {
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Missing required fields: query, rating' });
      }

      if (!['thumbs_up', 'thumbs_down'].includes(rating)) {
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid rating. Must be thumbs_up or thumbs_down' });
      }

      const { data, error } = await supa
        .from('chat_feedback')
        .insert({
          query: query.trim(),
          response_id: responseId || null,
          rating,
          reason: reason || null,
          user_feedback_text: userFeedbackText || null,
          confidence_score: confidenceScore || null,
          intent: intent || null,
          session_id: sessionId || null,
          user_agent: userAgent || null,
          page_url: pageUrl || null
        })
        .select()
        .single();

      if (error) {
        console.error('Feedback insert error:', error);
        return sendJSON(res, 500, { error: 'database_error', detail: error.message });
      }

      return sendJSON(res, 200, { 
        success: true, 
        feedback_id: data.id,
        message: 'Feedback recorded successfully' 
      });
    }

    if (req.method === 'GET') {
      // Get analytics data
      const { days = 7 } = req.query;
      
      const { data: analytics, error } = await supa
        .from('v_chat_feedback_analytics')
        .select('*')
        .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('Analytics query error:', error);
        return sendJSON(res, 500, { error: 'database_error', detail: error.message });
      }

      // Get recent feedback for investigation
      const { data: recentFeedback, error: recentError } = await supa
        .from('chat_feedback')
        .select('*')
        .eq('rating', 'thumbs_down')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (recentError) {
        console.error('Recent feedback query error:', recentError);
        return sendJSON(res, 500, { error: 'database_error', detail: recentError.message });
      }

      // Calculate summary stats
      const { data: summary, error: summaryError } = await supa
        .from('chat_feedback')
        .select('rating, confidence_score')
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (summaryError) {
        console.error('Summary query error:', summaryError);
        return sendJSON(res, 500, { error: 'database_error', detail: summaryError.message });
      }

      const totalFeedback = summary.length;
      const thumbsUp = summary.filter(s => s.rating === 'thumbs_up').length;
      const thumbsDown = summary.filter(s => s.rating === 'thumbs_down').length;
      const satisfactionRate = totalFeedback > 0 ? (thumbsUp / totalFeedback * 100).toFixed(1) : 0;
      const avgConfidence = summary.length > 0 ? 
        (summary.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / summary.length).toFixed(2) : 0;

      return sendJSON(res, 200, {
        success: true,
        analytics,
        recentFeedback,
        summary: {
          totalFeedback,
          thumbsUp,
          thumbsDown,
          satisfactionRate: parseFloat(satisfactionRate),
          avgConfidence: parseFloat(avgConfidence)
        }
      });
    }

    return sendJSON(res, 405, { error: 'method_not_allowed', detail: 'Only GET and POST methods allowed' });

  } catch (e) {
    console.error('Feedback API error:', e);
    return sendJSON(res, 500, { error: 'server_error', detail: String(e?.message || e) });
  }
}
