#!/usr/bin/env node
/**
 * Canonical 64-question regression harness.
 * POSTs each question to /api/chat with a single session_id: regression-64q-{ts}
 * (avoids the substring "regression-test", which skips server-side logging.)
 *
 * Loads questions from public/canonical-64q-questions.json
 * Optional: if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (e.g. .env.local),
 * fetches logged rows from chat_interactions, evaluates IDs 20–40, updates content_improvement_tracking.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local must win over a stale machine-level SUPABASE_SERVICE_ROLE_KEY (e.g. Academy ref).
dotenv.config({ path: path.join(__dirname, '.env.local'), override: true });
dotenv.config({ path: path.join(__dirname, '.env'), override: false });

const API_URL =
  process.env.CHAT_REGRESSION_API_URL || 'https://alan-chat-proxy.vercel.app/api/chat';

const FALLBACK_NEEDLES = [
  'i offer a range of photography services',
  "i'd be happy to help",
  'id be happy to help',
  'i cant find anything that confidently',
  "i can't find anything that confidently",
  'you can find more detailed information in my guides',
];

function norm(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function collapseKey(q) {
  return norm(q);
}

function plainAlphaNumLen(answer) {
  return norm(answer).replace(/[^a-z0-9\s]+/g, '').length;
}

function hasFallbackTemplate(answer) {
  const n = norm(answer);
  return FALLBACK_NEEDLES.some((needle) => n.includes(needle));
}

function looksLikeNavSoup(answer) {
  const n = norm(answer);
  const pipes = String(answer || '').split('|').length - 1;
  if (pipes >= 12) return true;
  return n.includes('sign in') && n.includes('cart') && n.includes('courses');
}

function isEducationalHowTo(q) {
  const n = norm(q);
  if (!/^how do i\b/.test(n)) return false;
  return (
    n.includes('photograph') ||
    n.includes('photography') ||
    n.includes('focus') ||
    n.includes('tripod') ||
    n.includes('take better') ||
    n.includes('improve') ||
    n.includes('settings') ||
    n.includes('use ')
  );
}

function isWhatIs(q) {
  return /^what is\b/.test(norm(q));
}

function evaluateAnswer(questionText, payload) {
  const reasons = [];
  const ans = payload.answerMarkdown || payload.answer || '';
  if (!payload.ok) reasons.push('request_failed');
  if (!ans.trim()) reasons.push('empty_answer');
  if (plainAlphaNumLen(ans) < 150) reasons.push('below_150_substantive');
  if (hasFallbackTemplate(ans)) reasons.push('fallback_template');
  if (looksLikeNavSoup(ans)) reasons.push('nav_soup');

  if (isEducationalHowTo(questionText) && payload.type === 'events') {
    reasons.push('education_routed_events');
  }

  if (isWhatIs(questionText)) {
    const na = norm(ans);
    const hasDefCue =
      /\b(is |are |means |refers to|involves|describes )\b/i.test(ans) ||
      na.includes('**') ||
      /\bconcept\b|\bdefinition\b|\bstyle\b|\bgenre\b|\btype of\b/i.test(ans);
    if (!hasDefCue && plainAlphaNumLen(ans) < 220) reasons.push('weak_definition');
  }

  return { pass: reasons.length === 0, reasons, plainLen: plainAlphaNumLen(ans) };
}

async function postQuestion(sessionId, question) {
  const body = JSON.stringify({
    query: question,
    sessionId,
    pageContext: null,
    topK: 10,
  });
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const raw = await res.text();
    let json = null;
    try {
      json = JSON.parse(raw);
    } catch {
      json = { parseError: true, raw: raw.slice(0, 500) };
    }
    const answerMarkdown = json.answer_markdown || json.answerMarkdown || '';
    const answer = json.answer || answerMarkdown || '';
    return {
      ok: res.ok && json.ok !== false && !json.parseError,
      status: res.status,
      type: json.type || null,
      confidence: json.confidence,
      answer,
      answerMarkdown: answerMarkdown || answer,
      question,
      rawSnippet: typeof raw === 'string' ? raw.slice(0, 200) : '',
    };
  } catch (e) {
    return {
      ok: false,
      type: null,
      confidence: 0,
      answer: '',
      answerMarkdown: '',
      question,
      error: String(e.message || e),
    };
  }
}

async function runRegressionBatch(sessionId, questions) {
  const results = [];
  let i = 0;
  const total = questions.length;
  for (const q of questions) {
    i += 1;
    const text = q.question;
    process.stdout.write(`[${i}/${total}] ${text.slice(0, 60)}…\n`);
    const payload = await postQuestion(sessionId, text);
    const ev = evaluateAnswer(text, payload);
    results.push({
      canonicalId: q.id,
      category: q.category,
      question: text,
      api: { ok: payload.ok, type: payload.type, confidence: payload.confidence },
      evaluation: ev,
    });
    await new Promise((r) => setTimeout(r, 350));
  }
  return results;
}

async function syncImprovementTracking(supa, results, tracking, nowIso) {
  for (const row of tracking || []) {
    const hitResult = results.find((r) => collapseKey(r.question) === collapseKey(row.question));
    if (!hitResult?.evaluation) {
      await supa
        .from('content_improvement_tracking')
        .update({ improvement_status: 'failed', updated_at: nowIso })
        .eq('id', row.id);
      console.log(`ID ${row.id}: failed (no matching canonical question)`);
      continue;
    }
    if (!hitResult.api.ok) {
      await supa
        .from('content_improvement_tracking')
        .update({ improvement_status: 'failed', updated_at: nowIso })
        .eq('id', row.id);
      console.log(`ID ${row.id}: failed (API error)`);
      continue;
    }
    const status = hitResult.evaluation.pass ? 'improved' : 'failed';
    const patch = { improvement_status: status, updated_at: nowIso };
    if (status === 'improved') patch.implemented_at = nowIso;
    await supa.from('content_improvement_tracking').update(patch).eq('id', row.id);
    console.log(`ID ${row.id}: ${status} (${hitResult.evaluation.reasons.join(', ') || 'ok'})`);
  }
}

async function appendOtherRegressionReport(supa, results, trackedKeys, sessionId, outDir, runTs) {
  const regressions = [];
  for (const r of results) {
    if (trackedKeys.has(collapseKey(r.question))) continue;
    const { data: hist, error: hErr } = await supa
      .from('chat_interactions')
      .select('answer, confidence, session_id, created_at')
      .eq('question', r.question)
      .ilike('session_id', 'regression-%')
      .order('created_at', { ascending: false })
      .limit(8);

    if (hErr || !hist || hist.length < 2) continue;
    const hasCurrent = hist.some((row) => row.session_id === sessionId);
    if (!hasCurrent) continue;

    const prior = hist.find((row) => row.session_id !== sessionId);
    if (!prior?.answer) continue;

    const prevPass = evaluateAnswer(r.question, {
      ok: true,
      type: null,
      confidence: Number(prior.confidence),
      answer: prior.answer,
      answerMarkdown: prior.answer,
    });
    if (prevPass.pass && !r.evaluation.pass) {
      regressions.push({ question: r.question, reasons: r.evaluation.reasons });
    }
  }

  const regOut = path.join(outDir, `regression-64q-${runTs}-other-regressions.json`);
  fs.writeFileSync(regOut, JSON.stringify(regressions, null, 2), 'utf8');
  console.log(`Other regressions flagged: ${regressions.length} (see ${regOut})`);
}

async function run() {
  const canonPath = path.join(__dirname, 'public', 'canonical-64q-questions.json');
  const raw = fs.readFileSync(canonPath, 'utf8');
  const data = JSON.parse(raw);
  const questions = data.questions || [];
  const expectedCount = typeof data.total_questions === 'number' ? data.total_questions : questions.length;
  if (questions.length !== expectedCount) {
    console.warn(`Expected ${expectedCount} questions (total_questions), got ${questions.length}`);
  }

  const runTs = Date.now();
  const sessionId = `regression-64q-${runTs}`;
  console.log(`Session: ${sessionId}`);
  console.log(`API: ${API_URL}`);

  const results = await runRegressionBatch(sessionId, questions);

  const outDir = path.join(__dirname, 'testing-scripts', 'regression-output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `regression-64q-${runTs}.json`);
  const artifact = {
    sessionId,
    apiUrl: API_URL,
    createdAt: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(outFile, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(`Wrote ${outFile}`);

  const passed = results.filter((r) => r.evaluation.pass).length;
  const totalQ = questions.length;
  console.log(`\nHeuristic pass (all ${totalQ}): ${passed}/${totalQ}`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      'No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env — skip DB sync. Use MCP or set .env.local.',
    );
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supa = createClient(url, key);

  const { data: tracking, error: trErr } = await supa
    .from('content_improvement_tracking')
    .select('id, question, improvement_status')
    .gte('id', 20)
    .lte('id', 40);

  if (trErr) {
    console.error('content_improvement_tracking read failed:', trErr.message);
    return;
  }

  const nowIso = new Date().toISOString();
  await syncImprovementTracking(supa, results, tracking, nowIso);
  console.log('content_improvement_tracking rows 20–40 updated.');

  const trackedKeys = new Set((tracking || []).map((t) => collapseKey(t.question)));
  await appendOtherRegressionReport(supa, results, trackedKeys, sessionId, outDir, runTs);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
