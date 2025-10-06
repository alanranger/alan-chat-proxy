// /api/analytics.js
// Analytics dashboard API endpoint
// Provides aggregated data for the analytics dashboard

export const config = { runtime: 'nodejs' };

import { createClient } from '@supabase/supabase-js';

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

/* ========== handler ========== */
export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJSON(res, 405, { error: 'method_not_allowed' });

  let stage = 'start';
  try {
    stage = 'auth';
    const token = req.headers['authorization']?.trim();
    if (token !== `Bearer ${need('INGEST_TOKEN')}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const { action, days = 7 } = req.query || {};

    switch (action) {
      case 'overview':
        {
          // Get overview metrics for the last N days
          const { data: dailyData, error: dailyError } = await supa
            .from('chat_analytics_daily')
            .select('*')
            .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: true });

          if (dailyError) throw new Error(`Daily data failed: ${dailyError.message}`);

          // Calculate totals
          const totals = dailyData.reduce((acc, day) => ({
            sessions: acc.sessions + (day.total_sessions || 0),
            questions: acc.questions + (day.total_questions || 0),
            interactions: acc.interactions + (day.total_interactions || 0),
            avgConfidence: acc.avgConfidence + (day.avg_confidence || 0),
            avgResponseTime: acc.avgResponseTime + (day.avg_response_time_ms || 0)
          }), { sessions: 0, questions: 0, interactions: 0, avgConfidence: 0, avgResponseTime: 0 });

          const dayCount = dailyData.length || 1;
          totals.avgConfidence = totals.avgConfidence / dayCount;
          totals.avgResponseTime = totals.avgResponseTime / dayCount;

          // Get recent sessions
          const { data: recentSessions, error: sessionsError } = await supa
            .from('chat_sessions')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(10);

          if (sessionsError) throw new Error(`Recent sessions failed: ${sessionsError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            overview: {
              totals,
              dailyData,
              recentSessions: recentSessions || []
            }
          });
        }

      case 'questions':
        {
          // Get top questions
          const { data: topQuestions, error: questionsError } = await supa
            .from('chat_question_frequency')
            .select('*')
            .order('frequency', { ascending: false })
            .limit(20);

          if (questionsError) throw new Error(`Top questions failed: ${questionsError.message}`);

          // Get recent questions
          const { data: recentQuestions, error: recentError } = await supa
            .from('chat_interactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (recentError) throw new Error(`Recent questions failed: ${recentError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            questions: {
              topQuestions: topQuestions || [],
              recentQuestions: recentQuestions || []
            }
          });
        }

      case 'sessions':
        {
          const { page = 1, limit = 20, search } = req.query || {};
          const offset = (page - 1) * limit;

          let query = supa
            .from('chat_sessions')
            .select('*')
            .order('started_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (search) {
            query = query.ilike('session_id', `%${search}%`);
          }

          const { data: sessions, error: sessionsError } = await query;

          if (sessionsError) throw new Error(`Sessions failed: ${sessionsError.message}`);

          // Get total count
          const { count, error: countError } = await supa
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true });

          if (countError) throw new Error(`Count failed: ${countError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            sessions: {
              data: sessions || [],
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                pages: Math.ceil((count || 0) / limit)
              }
            }
          });
        }

      case 'session_detail':
        {
          const { sessionId } = req.query || {};
          if (!sessionId) return sendJSON(res, 400, { error: 'bad_request', detail: 'Provide sessionId' });

          // Get session details
          const { data: session, error: sessionError } = await supa
            .from('chat_sessions')
            .select('*')
            .eq('session_id', sessionId)
            .single();

          if (sessionError) throw new Error(`Session failed: ${sessionError.message}`);

          // Get session interactions
          const { data: interactions, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

          if (interactionsError) throw new Error(`Interactions failed: ${interactionsError.message}`);

          // Get session events
          const { data: events, error: eventsError } = await supa
            .from('chat_events')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

          if (eventsError) throw new Error(`Events failed: ${eventsError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            session: {
              session,
              interactions: interactions || [],
              events: events || []
            }
          });
        }

      case 'performance':
        {
          // Get performance metrics for the last N days
          const { data: performanceData, error: perfError } = await supa
            .from('chat_analytics_daily')
            .select('date, avg_confidence, avg_response_time_ms')
            .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('date', { ascending: true });

          if (perfError) throw new Error(`Performance data failed: ${perfError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            performance: {
              data: performanceData || []
            }
          });
        }

      case 'insights':
        {
          // Get insights and recommendations
          const { data: lowConfidence, error: lowConfError } = await supa
            .from('chat_question_frequency')
            .select('*')
            .lt('avg_confidence', 0.5)
            .order('frequency', { ascending: false })
            .limit(10);

          if (lowConfError) throw new Error(`Low confidence failed: ${lowConfError.message}`);

          const { data: frequentQuestions, error: freqError } = await supa
            .from('chat_question_frequency')
            .select('*')
            .order('frequency', { ascending: false })
            .limit(10);

          if (freqError) throw new Error(`Frequent questions failed: ${freqError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            insights: {
              lowConfidenceQuestions: lowConfidence || [],
              frequentQuestions: frequentQuestions || [],
              recommendations: [
                ...(lowConfidence || []).map(q => ({
                  type: 'content_gap',
                  priority: 'high',
                  message: `Consider improving content for: "${q.question_text.substring(0, 100)}..."`,
                  question: q.question_text,
                  frequency: q.frequency,
                  avgConfidence: q.avg_confidence
                })),
                ...(frequentQuestions || []).slice(0, 3).map(q => ({
                  type: 'content_priority',
                  priority: 'medium',
                  message: `High-frequency question: "${q.question_text.substring(0, 100)}..."`,
                  question: q.question_text,
                  frequency: q.frequency
                }))
              ]
            }
          });
        }

      default:
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid action. Use: overview, questions, sessions, session_detail, performance, insights' });
    }

  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
