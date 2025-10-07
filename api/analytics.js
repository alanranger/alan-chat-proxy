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
    const expectedToken = process.env.INGEST_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
    if (token !== `Bearer ${expectedToken}`) {
      return sendJSON(res, 401, { error: 'unauthorized', stage });
    }

    stage = 'db_client';
    const supa = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const { action, days = 7 } = req.query || {};

    switch (action) {
      case 'overview':
        {
          // Get overview metrics for the last N days (fallback to live counts to avoid stale aggregates)
          const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

          // Try to load daily aggregates for charts (may be empty during testing)
          const { data: dailyData = [], error: dailyError } = await supa
            .from('chat_analytics_daily')
            .select('*')
            .gte('date', sinceIso.split('T')[0])
            .order('date', { ascending: true });

          if (dailyError) console.warn('Daily data failed:', dailyError.message);

          // Live totals from base tables so they always reflect reality
          const [sessionsCountRes, answeredCountRes] = await Promise.all([
            supa.from('chat_sessions').select('session_id', { count: 'exact', head: true }).gte('started_at', sinceIso),
            supa.from('chat_interactions').select('id', { count: 'exact', head: true }).not('answer', 'is', null).gte('created_at', sinceIso)
          ]);
          const sessionsCount = sessionsCountRes?.count || 0;
          const answeredCount = answeredCountRes?.count || 0;

          // Live averages from answered interactions for accuracy
          const { data: answeredRows = [], error: answeredRowsError } = await supa
            .from('chat_interactions')
            .select('confidence,response_time_ms')
            .not('answer', 'is', null)
            .gte('created_at', sinceIso);
          if (answeredRowsError) console.warn('Answered rows fetch failed:', answeredRowsError.message);

          let confSum = 0, confN = 0, rtSum = 0, rtN = 0;
          for (const r of answeredRows) {
            if (typeof r.confidence === 'number') { confSum += r.confidence; confN += 1; }
            if (typeof r.response_time_ms === 'number') { rtSum += r.response_time_ms; rtN += 1; }
          }

          const totals = {
            sessions: sessionsCount || 0,
            questions: answeredCount || 0,
            interactions: answeredCount || 0,
            avgConfidence: confN ? (confSum / confN) : 0,
            avgResponseTime: rtN ? (rtSum / rtN) : 0
          };

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
              dailyData: dailyData || [],
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

          // Recompute per-session answered question counts to avoid stale totals
          if (sessions && sessions.length) {
            const sessionIds = sessions.map(s => s.session_id);
            const { data: perSessionCounts, error: perSessionError } = await supa
              .from('chat_interactions')
              .select('session_id', { count: 'exact' })
              .not('answer', 'is', null)
              .in('session_id', sessionIds);
            if (!perSessionError && Array.isArray(perSessionCounts)) {
              const countsBySession = {};
              perSessionCounts.forEach(r => {
                countsBySession[r.session_id] = (countsBySession[r.session_id] || 0) + 1;
              });
              sessions.forEach(s => {
                s.total_questions = countsBySession[s.session_id] || 0;
              });
            }
          }

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
          // Build performance metrics from answered interactions (live, not stale aggregates)
          const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

          const { data: interactions, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('created_at, confidence, response_time_ms')
            .not('answer', 'is', null)
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: true });

          if (interactionsError) throw new Error(`Performance data failed: ${interactionsError.message}`);

          // Aggregate by day (local date string YYYY-MM-DD)
          const byDay = {};
          for (const row of interactions || []) {
            const day = new Date(row.created_at).toISOString().split('T')[0];
            if (!byDay[day]) byDay[day] = { count: 0, confSum: 0, rtSum: 0 };
            byDay[day].count += 1;
            byDay[day].confSum += typeof row.confidence === 'number' ? row.confidence : 0;
            byDay[day].rtSum += typeof row.response_time_ms === 'number' ? row.response_time_ms : 0;
          }

          const dates = Object.keys(byDay).sort();
          const performanceData = dates.map(d => ({
            date: d,
            avg_confidence: byDay[d].count ? byDay[d].confSum / byDay[d].count : 0,
            avg_response_time_ms: byDay[d].count ? Math.round(byDay[d].rtSum / byDay[d].count) : 0,
            questions: byDay[d].count
          }));

          return sendJSON(res, 200, { ok: true, performance: { data: performanceData } });
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

      case 'question_detail':
        {
          const { question } = req.query || {};
          if (!question) {
            return sendJSON(res, 400, { error: 'bad_request', detail: 'Question parameter is required' });
          }

          // Get all interactions for this specific question
          const { data: interactions, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('*')
            .eq('question', question)
            // Only count answered interactions to avoid double-counting question-only rows
            .not('answer', 'is', null)
            .order('created_at', { ascending: false });

          if (interactionsError) throw new Error(`Question detail failed: ${interactionsError.message}`);

          return sendJSON(res, 200, {
            ok: true,
            question: {
              interactions: interactions || []
            }
          });
        }

      case 'admin_counts':
        {
          // Get real-time counts for admin panel
          const { data: interactionsCount, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('id', { count: 'exact', head: true });
          
          if (interactionsError) throw new Error(`Count interactions failed: ${interactionsError.message}`);
          
          const { data: sessionsCount, error: sessionsError } = await supa
            .from('chat_sessions')
            .select('session_id', { count: 'exact', head: true });
          
          if (sessionsError) throw new Error(`Count sessions failed: ${sessionsError.message}`);
          
          const { data: questionsCount, error: questionsError } = await supa
            .from('chat_question_frequency')
            .select('id', { count: 'exact', head: true });
          
          if (questionsError) throw new Error(`Count questions failed: ${questionsError.message}`);
          
          return sendJSON(res, 200, {
            ok: true,
            counts: {
              interactions: interactionsCount || 0,
              sessions: sessionsCount || 0,
              questions: questionsCount || 0
            }
          });
        }

      case 'admin_preview':
        {
          const { startDate, endDate, questionText, sessionId, confidence } = req.query || {};
          
          // Build Supabase query filters
          let interactionsQuery = supa.from('chat_interactions').select('*');
          let sessionsQuery = supa.from('chat_sessions').select('*');
          let questionsQuery = supa.from('chat_question_frequency').select('*');
          
          // Apply filters
          if (startDate) {
            interactionsQuery = interactionsQuery.gte('created_at', startDate);
            sessionsQuery = sessionsQuery.gte('started_at', startDate);
            questionsQuery = questionsQuery.gte('last_seen', startDate);
          }
          if (endDate) {
            interactionsQuery = interactionsQuery.lte('created_at', endDate + ' 23:59:59');
            sessionsQuery = sessionsQuery.lte('started_at', endDate + ' 23:59:59');
            questionsQuery = questionsQuery.lte('last_seen', endDate + ' 23:59:59');
          }
          if (questionText) {
            interactionsQuery = interactionsQuery.ilike('question', `%${questionText}%`);
            questionsQuery = questionsQuery.ilike('question_text', `%${questionText}%`);
          }
          if (sessionId) {
            interactionsQuery = interactionsQuery.ilike('session_id', `%${sessionId}%`);
            sessionsQuery = sessionsQuery.ilike('session_id', `%${sessionId}%`);
          }
          if (confidence) {
            if (confidence === 'low') {
              interactionsQuery = interactionsQuery.lt('confidence', 0.5);
            } else if (confidence === 'medium') {
              interactionsQuery = interactionsQuery.gte('confidence', 0.5).lte('confidence', 0.8);
            } else if (confidence === 'high') {
              interactionsQuery = interactionsQuery.gt('confidence', 0.8);
            }
          }
          
          // Execute queries
          const { data: interactions, error: interactionsError } = await interactionsQuery
            .order('created_at', { ascending: false })
            .limit(100);
          
          if (interactionsError) throw new Error(`Preview interactions failed: ${interactionsError.message}`);
          
          const { data: sessions, error: sessionsError } = await sessionsQuery
            .order('started_at', { ascending: false })
            .limit(100);
          
          if (sessionsError) throw new Error(`Preview sessions failed: ${sessionsError.message}`);
          
          const { data: questions, error: questionsError } = await questionsQuery
            .order('last_seen', { ascending: false })
            .limit(100);
          
          if (questionsError) throw new Error(`Preview questions failed: ${questionsError.message}`);
          
          return sendJSON(res, 200, {
            ok: true,
            preview: {
              interactions: interactions || [],
              sessions: sessions || [],
              questions: questions || []
            }
          });
        }

      case 'admin_delete':
        {
          const { startDate, endDate, questionText, sessionId, confidence } = req.query || {};
          
          let deletedCounts = { interactions: 0, sessions: 0, questions: 0 };
          
          // First, get the IDs of interactions to delete
          let selectQuery = supa.from('chat_interactions').select('id');
          
          // Apply filters
          if (startDate) {
            selectQuery = selectQuery.gte('created_at', startDate);
          }
          if (endDate) {
            selectQuery = selectQuery.lte('created_at', endDate + ' 23:59:59');
          }
          if (questionText) {
            selectQuery = selectQuery.ilike('question', `%${questionText}%`);
          }
          if (sessionId) {
            selectQuery = selectQuery.ilike('session_id', `%${sessionId}%`);
          }
          if (confidence) {
            if (confidence === 'low') {
              selectQuery = selectQuery.lt('confidence', 0.5);
            } else if (confidence === 'medium') {
              selectQuery = selectQuery.gte('confidence', 0.5).lte('confidence', 0.8);
            } else if (confidence === 'high') {
              selectQuery = selectQuery.gt('confidence', 0.8);
            }
          }
          
          const { data: interactionsToDelete, error: selectError } = await selectQuery;
          if (selectError) throw new Error(`Select interactions failed: ${selectError.message}`);
          
          if (interactionsToDelete && interactionsToDelete.length > 0) {
            const idsToDelete = interactionsToDelete.map(i => i.id);
            
            // Delete interactions by IDs
            const { error: interactionsError } = await supa
              .from('chat_interactions')
              .delete()
              .in('id', idsToDelete);
            
            if (interactionsError) throw new Error(`Delete interactions failed: ${interactionsError.message}`);
            deletedCounts.interactions = idsToDelete.length;
          }
          
          // Clean up orphaned sessions and questions using SQL
          const { error: sessionsError } = await supa.rpc('cleanup_orphaned_sessions');
          if (sessionsError) {
            console.warn('Cleanup sessions failed:', sessionsError.message);
          }
          
          const { error: questionsError } = await supa.rpc('cleanup_orphaned_questions');
          if (questionsError) {
            console.warn('Cleanup questions failed:', questionsError.message);
          }
          
          return sendJSON(res, 200, {
            ok: true,
            deleted: deletedCounts
          });
        }

      case 'admin_clear_all':
        {
          // Clear all data using simple delete queries
          const { error: interactionsError } = await supa.from('chat_interactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (interactionsError) throw new Error(`Clear interactions failed: ${interactionsError.message}`);
          
          const { error: sessionsError } = await supa.from('chat_sessions').delete().neq('session_id', 'dummy');
          if (sessionsError) throw new Error(`Clear sessions failed: ${sessionsError.message}`);
          
          const { error: questionsError } = await supa.from('chat_question_frequency').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (questionsError) throw new Error(`Clear questions failed: ${questionsError.message}`);
          
          return sendJSON(res, 200, {
            ok: true,
            message: 'All data cleared successfully'
          });
        }

      default:
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid action. Use: overview, questions, sessions, session_detail, question_detail, performance, insights, admin_counts, admin_preview, admin_delete, admin_clear_all' });
    }

  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
