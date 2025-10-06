// /api/chat-log.js
// Chat usage logging endpoint
// Handles logging of chat sessions, interactions, and events

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

/* ========== utils ========== */
const need = (k) => {
  const v = process.env[k];
  if (!v || !String(v).trim()) throw new Error(`missing_env:${k}`);
  return v;
};

const asString = (e) => {
  if (!e) return '(unknown)';
  if (typeof e === 'string') return e;
  if (e.message && typeof e.message === 'string') return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
};

const sendJSON = (res, status, obj) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (obj && 'detail' in obj) obj.detail = asString(obj.detail);
  res.status(status).send(JSON.stringify(obj));
};

// Hash IP for privacy
const hashIP = (ip) => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + 'chat-log-salt').digest('hex').substring(0, 16);
};

// Detect device type from user agent
const detectDeviceType = (userAgent) => {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(ua)) return 'mobile';
  if (/tablet|ipad/.test(ua)) return 'tablet';
  return 'desktop';
};

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'parse_body';
    const { action, data } = req.body || {};
    if (!action) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide "action"', stage });

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const referrer = req.headers['referer'] || null;

    switch (action) {
      case 'session_start':
        {
          const { sessionId } = data || {};
          if (!sessionId) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId', stage });

          const { error } = await supa.from('chat_sessions').insert([{
            session_id: sessionId,
            user_agent: userAgent,
            ip_hash: hashIP(clientIP),
            device_type: detectDeviceType(userAgent),
            referrer: referrer
          }]);

          if (error) throw new Error(`Session start failed: ${error.message}`);
          return sendJSON(res, 200, { ok: true, action: 'session_start' });
        }

      case 'session_end':
        {
          const { sessionId } = data || {};
          if (!sessionId) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId', stage });

          const { error } = await supa.from('chat_sessions')
            .update({ ended_at: new Date().toISOString() })
            .eq('session_id', sessionId);

          if (error) throw new Error(`Session end failed: ${error.message}`);
          return sendJSON(res, 200, { ok: true, action: 'session_end' });
        }

      case 'question':
        {
          const { sessionId, question, answer, intent, confidence, responseTimeMs, sourcesUsed } = data || {};
          if (!sessionId || !question) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId and question', stage });
          }

          const { error } = await supa.from('chat_interactions').insert([{
            session_id: sessionId,
            question: question,
            answer: answer || null,
            intent: intent || null,
            confidence: confidence || null,
            response_time_ms: responseTimeMs || null,
            sources_used: sourcesUsed || null
          }]);

          if (error) throw new Error(`Question log failed: ${error.message}`);

          // Update session question count
          await supa.rpc('increment_session_questions', { session_id: sessionId });

          return sendJSON(res, 200, { ok: true, action: 'question' });
        }

      case 'event':
        {
          const { sessionId, eventType, eventData } = data || {};
          if (!sessionId || !eventType) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId and eventType', stage });
          }

          const { error } = await supa.from('chat_events').insert([{
            session_id: sessionId,
            event_type: eventType,
            event_data: eventData || null
          }]);

          if (error) throw new Error(`Event log failed: ${error.message}`);

          // Update session interaction count
          await supa.rpc('increment_session_interactions', { session_id: sessionId });

          return sendJSON(res, 200, { ok: true, action: 'event' });
        }

      case 'feedback':
        {
          const { sessionId, questionId, feedback } = data || {};
          if (!sessionId || !questionId || !feedback) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId, questionId, and feedback', stage });
          }

          const { error } = await supa.from('chat_interactions')
            .update({ user_feedback: feedback })
            .eq('id', questionId)
            .eq('session_id', sessionId);

          if (error) throw new Error(`Feedback log failed: ${error.message}`);
          return sendJSON(res, 200, { ok: true, action: 'feedback' });
        }

      default:
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid action. Use: session_start, session_end, question, event, feedback', stage });
    }

  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
