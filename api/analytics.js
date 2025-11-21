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
          // Calculate question frequency on-demand from chat_interactions
          // (chat_question_frequency table was dropped as redundant)
          const { data: allInteractions, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('question, confidence, created_at, page_context, session_id')
            .not('question', 'is', null)
            .not('answer', 'is', null)  // Only count answered questions
            .order('created_at', { ascending: false })
            .limit(10000);  // Limit to recent interactions for performance

          if (interactionsError) throw new Error(`Top questions failed: ${interactionsError.message}`);

          // Filter out regression test sessions:
          // 1. Sessions starting with "test-" (regression test pattern)
          // 2. Sessions with exactly 40 interactions (40q regression test pattern)
          const sessionCounts = {};
          (allInteractions || []).forEach(r => {
            sessionCounts[r.session_id] = (sessionCounts[r.session_id] || 0) + 1;
          });
          const regressionTestSessions = new Set(
            Object.entries(sessionCounts)
              .filter(([sessionId, count]) => 
                sessionId.startsWith('test-') || count === 40
              )
              .map(([sessionId, _]) => sessionId)
          );

          // Filter out regression test sessions
          const filteredInteractions = (allInteractions || []).filter(
            r => !regressionTestSessions.has(r.session_id)
          );

          // Aggregate question frequency and calculate averages
          const questionStats = {};
          filteredInteractions.forEach((r) => {
            const q = r.question?.trim();
            if (!q) return;

            if (!questionStats[q]) {
              questionStats[q] = {
                question_text: q,
                frequency: 0,
                confidence_sum: 0,
                confidence_count: 0,
                last_seen: r.created_at,
                last_page: null
              };
            }

            questionStats[q].frequency += 1;
            if (typeof r.confidence === 'number') {
              questionStats[q].confidence_sum += r.confidence;
              questionStats[q].confidence_count += 1;
            }
            
            // Update last_seen if this is more recent
            if (new Date(r.created_at) > new Date(questionStats[q].last_seen)) {
              questionStats[q].last_seen = r.created_at;
              // Update last_page from most recent interaction
              const pc = r.page_context || {};
              questionStats[q].last_page = pc.pathname || pc.url || null;
            } else if (!questionStats[q].last_page) {
              // Fallback: use page from any interaction if we don't have one yet
              const pc = r.page_context || {};
              questionStats[q].last_page = pc.pathname || pc.url || null;
            }
          });

          // Convert to array and calculate avg_confidence
          const topQuestions = Object.values(questionStats)
            .map(q => ({
              question_text: q.question_text,
              frequency: q.frequency,
              avg_confidence: q.confidence_count > 0 ? q.confidence_sum / q.confidence_count : null,
              last_seen: q.last_seen,
              last_page: q.last_page
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 1000);  // Top 1000 by frequency

          // Get recent questions for the recentQuestions array (excluding regression tests)
          const recentQuestions = filteredInteractions
            .slice(0, 50)
            .map(r => ({
              question: r.question,
              created_at: r.created_at,
              page_context: r.page_context
            }));

          return sendJSON(res, 200, {
            ok: true,
            questions: {
              topQuestions: topQuestions,
              recentQuestions: recentQuestions
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
          // Calculate question frequency on-demand from chat_interactions
          const { data: allInteractions, error: interactionsError } = await supa
            .from('chat_interactions')
            .select('question, confidence, session_id')
            .not('question', 'is', null)
            .not('answer', 'is', null);

          if (interactionsError) throw new Error(`Insights data failed: ${interactionsError.message}`);

          // Filter out regression test sessions:
          // 1. Sessions starting with "test-" (regression test pattern)
          // 2. Sessions with exactly 40 interactions (40q regression test pattern)
          const sessionCounts = {};
          (allInteractions || []).forEach(r => {
            sessionCounts[r.session_id] = (sessionCounts[r.session_id] || 0) + 1;
          });
          const regressionTestSessions = new Set(
            Object.entries(sessionCounts)
              .filter(([sessionId, count]) => 
                sessionId.startsWith('test-') || count === 40
              )
              .map(([sessionId, _]) => sessionId)
          );
          const filteredInteractions = (allInteractions || []).filter(
            r => !regressionTestSessions.has(r.session_id)
          );

          // Aggregate question frequency and confidence
          const questionStats = {};
          filteredInteractions.forEach((r) => {
            const q = r.question?.trim();
            if (!q) return;

            if (!questionStats[q]) {
              questionStats[q] = {
                question_text: q,
                frequency: 0,
                confidence_sum: 0,
                confidence_count: 0
              };
            }

            questionStats[q].frequency += 1;
            if (typeof r.confidence === 'number') {
              questionStats[q].confidence_sum += r.confidence;
              questionStats[q].confidence_count += 1;
            }
          });

          // Convert to array and calculate avg_confidence
          const allQuestions = Object.values(questionStats)
            .map(q => ({
              question_text: q.question_text,
              frequency: q.frequency,
              avg_confidence: q.confidence_count > 0 ? q.confidence_sum / q.confidence_count : null
            }));

          // Get low confidence questions
          const lowConfidence = allQuestions
            .filter(q => q.avg_confidence !== null && q.avg_confidence < 0.5)
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

          // Get frequent questions
          const frequentQuestions = allQuestions
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

          // Get feedback data
          const { data: feedbackData, error: feedbackError } = await supa
            .from('chat_feedback')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(50);

          if (feedbackError) console.warn('Feedback data failed:', feedbackError.message);

          // Calculate feedback summary
          const feedbackSummary = {
            total: feedbackData?.length || 0,
            thumbsUp: feedbackData?.filter(f => f.rating === 'thumbs_up').length || 0,
            thumbsDown: feedbackData?.filter(f => f.rating === 'thumbs_down').length || 0,
            satisfactionRate: 0,
            avgConfidenceThumbsDown: 0
          };

          if (feedbackSummary.total > 0) {
            feedbackSummary.satisfactionRate = (feedbackSummary.thumbsUp / feedbackSummary.total) * 100;
            const thumbsDownItems = feedbackData?.filter(f => f.rating === 'thumbs_down' && f.confidence_score);
            if (thumbsDownItems?.length > 0) {
              feedbackSummary.avgConfidenceThumbsDown = thumbsDownItems.reduce((sum, f) => sum + f.confidence_score, 0) / thumbsDownItems.length;
            }
          }

          return sendJSON(res, 200, {
            ok: true,
            insights: {
              lowConfidenceQuestions: lowConfidence || [],
              frequentQuestions: frequentQuestions || [],
              feedbackSummary,
              recentFeedback: feedbackData?.slice(0, 10) || [],
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
                })),
                // Add feedback-based recommendations
                ...(feedbackSummary.thumbsDown > 0 ? [{
                  type: 'user_feedback',
                  priority: 'high',
                  message: `${feedbackSummary.thumbsDown} thumbs down feedback received - investigate user satisfaction`,
                  question: 'User Feedback Analysis',
                  frequency: feedbackSummary.thumbsDown,
                  avgConfidence: feedbackSummary.avgConfidenceThumbsDown
                }] : [])
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
          // Use the same definitions as Overview: questions == answered interactions
          const [sessionsRes, answeredRes] = await Promise.all([
            supa.from('chat_sessions').select('session_id', { count: 'exact', head: true }),
            supa.from('chat_interactions').select('id', { count: 'exact', head: true }).not('answer', 'is', null)
          ]);
          if (sessionsRes.error) throw new Error(`Count sessions failed: ${sessionsRes.error.message}`);
          if (answeredRes.error) throw new Error(`Count answered interactions failed: ${answeredRes.error.message}`);
          const sessions = sessionsRes.count || 0;
          const answered = answeredRes.count || 0;
          return sendJSON(res, 200, {
            ok: true,
            counts: {
              interactions: answered,
              sessions,
              questions: answered
            }
          });
        }

      case 'admin_preview':
        {
          const { startDate, endDate, questionText, sessionId, confidence } = req.query || {};
          
          // Build Supabase query filters
          let interactionsQuery = supa.from('chat_interactions').select('*');
          let sessionsQuery = supa.from('chat_sessions').select('*');
          // Questions are calculated on-demand, so we'll filter interactions instead
          // Apply filters
          if (startDate) {
            interactionsQuery = interactionsQuery.gte('created_at', startDate);
            sessionsQuery = sessionsQuery.gte('started_at', startDate);
          }
          if (endDate) {
            interactionsQuery = interactionsQuery.lte('created_at', endDate + ' 23:59:59');
            sessionsQuery = sessionsQuery.lte('started_at', endDate + ' 23:59:59');
          }
          if (questionText) {
            interactionsQuery = interactionsQuery.ilike('question', `%${questionText}%`);
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
          
          // Calculate questions on-demand from filtered interactions
          const questionStats = {};
          (interactions || []).forEach((r) => {
            const q = r.question?.trim();
            if (!q) return;
            if (!questionStats[q]) {
              questionStats[q] = {
                question_text: q,
                frequency: 0,
                last_seen: r.created_at
              };
            }
            questionStats[q].frequency += 1;
            if (new Date(r.created_at) > new Date(questionStats[q].last_seen)) {
              questionStats[q].last_seen = r.created_at;
            }
          });
          const questions = Object.values(questionStats)
            .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
            .slice(0, 100);
          
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
          
          // Questions are calculated on-demand from chat_interactions, so no separate table to clear
          // Questions will be cleared when interactions are cleared
          
          return sendJSON(res, 200, {
            ok: true,
            message: 'All data cleared successfully'
          });
        }

      case 'feedback':
        {
          const { days = 7 } = req.query || {};
          const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

          // Get feedback data
          const { data: feedbackData, error: feedbackError } = await supa
            .from('chat_feedback')
            .select('*')
            .gte('timestamp', sinceIso)
            .order('timestamp', { ascending: false });

          if (feedbackError) throw new Error(`Feedback data failed: ${feedbackError.message}`);

          // Calculate summary stats
          const totalFeedback = feedbackData?.length || 0;
          const thumbsUp = feedbackData?.filter(f => f.rating === 'thumbs_up').length || 0;
          const thumbsDown = feedbackData?.filter(f => f.rating === 'thumbs_down').length || 0;
          const satisfactionRate = totalFeedback > 0 ? (thumbsUp / totalFeedback) * 100 : 0;
          
          // Get average confidence for thumbs down
          const thumbsDownItems = feedbackData?.filter(f => f.rating === 'thumbs_down' && f.confidence_score);
          const avgConfidenceThumbsDown = thumbsDownItems?.length > 0 ? 
            thumbsDownItems.reduce((sum, f) => sum + f.confidence_score, 0) / thumbsDownItems.length : 0;

          // Get recent feedback for investigation
          const recentFeedback = feedbackData?.slice(0, 20) || [];

          return sendJSON(res, 200, {
            ok: true,
            feedback: {
              summary: {
                totalFeedback,
                thumbsUp,
                thumbsDown,
                satisfactionRate,
                avgConfidenceThumbsDown
              },
              recentFeedback,
              allFeedback: feedbackData || []
            }
          });
        }

      case 'feedback_submit':
        {
          // Handle feedback submission (POST only)
          if (req.method !== 'POST') {
            return sendJSON(res, 405, { error: 'method_not_allowed', detail: 'POST method required for feedback submission' });
          }

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

      case 'pill_clicks':
        {
          const { days = 7 } = req.query || {};
          const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

          // Get all pill click events
          const { data: pillEvents, error: eventsError } = await supa
            .from('chat_events')
            .select('*')
            .eq('event_type', 'pill_click')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false });

          if (eventsError) throw new Error(`Pill clicks fetch failed: ${eventsError.message}`);

          // Aggregate by pill type and label
          const byType = {};
          const byLabel = {};
          const bySession = {};
          let totalClicks = 0;

          (pillEvents || []).forEach(event => {
            const eventData = event.event_data || {};
            const pillType = eventData.pill_type || 'unknown';
            const pillLabel = eventData.pill_label || 'Unknown';
            const sessionId = event.session_id;

            totalClicks++;

            // Count by type
            byType[pillType] = (byType[pillType] || 0) + 1;

            // Count by label
            byLabel[pillLabel] = (byLabel[pillLabel] || 0) + 1;

            // Count unique sessions per type
            if (!bySession[pillType]) bySession[pillType] = new Set();
            bySession[pillType].add(sessionId);
          });

          // Convert session sets to counts
          const sessionsByType = {};
          Object.keys(bySession).forEach(type => {
            sessionsByType[type] = bySession[type].size;
          });

          // Get total unique sessions with pill clicks
          const uniqueSessions = new Set((pillEvents || []).map(e => e.session_id));
          const totalSessions = uniqueSessions.size;

          // Calculate click-through rate (sessions with pill clicks / total sessions)
          const { count: totalSessionsCount } = await supa
            .from('chat_sessions')
            .select('*', { count: 'exact', head: true })
            .gte('started_at', sinceIso);
          
          const clickThroughRate = totalSessionsCount > 0 
            ? (totalSessions / totalSessionsCount * 100).toFixed(1)
            : 0;

          return sendJSON(res, 200, {
            ok: true,
            pillClicks: {
              totalClicks,
              totalSessions,
              clickThroughRate: parseFloat(clickThroughRate),
              clicksByType: byType,
              clicksByLabel: byLabel,
              sessionsByType: sessionsByType,
              recentClicks: (pillEvents || []).slice(0, 50).map(e => ({
                session_id: e.session_id,
                pill_type: e.event_data?.pill_type || 'unknown',
                pill_label: e.event_data?.pill_label || 'Unknown',
                pill_url: e.event_data?.pill_url || null,
                clicked_at: e.created_at
              }))
            }
          });
        }

      default:
        return sendJSON(res, 400, { error: 'bad_request', detail: 'Invalid action. Use: overview, questions, sessions, session_detail, question_detail, performance, insights, feedback, feedback_submit, admin_counts, admin_preview, admin_delete, admin_clear_all, pill_clicks' });
    }

  } catch (err) {
    return sendJSON(res, 500, { error: 'server_error', detail: asString(err), stage });
  }
}
