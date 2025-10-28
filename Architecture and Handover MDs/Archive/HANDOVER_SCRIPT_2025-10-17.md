---
title: "AI Handover Script — 2025-10-17"
project: "Alan Ranger – Chat AI Bot"
maintainer: "Alan Ranger"
category: "Governance / Handover"
last_updated: "2025-10-17"
purpose: >
  Ready-to-paste handover for a fresh Cursor chat thread. Continues Sonar-driven
  complexity reductions in `api/chat.js` with strict regression gates using the
  live `public/chat.html` UI and the exhaustive clarification suite.
tags:
  - Handover
  - Regression Suite
  - SonarQube
  - Complexity
---

# Quick Start (Paste into new Cursor thread)

1) Load context from:
   - `Architecture and Handover/HANDOVER_SCRIPT_2025-10-17.md`
   - `Architecture and Handover/HANDOVER_SCRIPT_TEMPLATE.md`
   - `notes/store/AI_TODO.md`

2) Operating mode: unattended. Do not stop between steps unless a test fails or a hard error occurs.

3) Test gates (must both PASS after each patch):
   - Live UI baseline: `node test-live-chat-interface.js` (uses https://alan-chat-proxy.vercel.app/chat.html)
   - Exhaustive clarifications (depth 5):
     `node scripts/exhaustive-clarifications.js --max-depth 5 --out results/sonar-fixes/<target>/after-$(date +%F-%H%M)`

# Current Status (2025-10-17)

- Live API stable (500s were resolved earlier by guards on missing functions/vars).
- Live UI baseline runner fixed (real selectors). Baseline passes 15/15; 2 expected fallbacks remain (investigate later).
- Refactors completed and verified (no behavior change):
  - L4334: extracted `maybeProcessEarlyReturnFallback` and re-wired early-return call site.
  - L5500: extracted `scoreArticle` helper (article scoring).
  - L5685: simplified Factor 2 accumulation in advice confidence.
- Each change deployed to main with a 30s wait and full live UI baseline re-run; exhaustive BEFORE runs captured.
- L1886 refactor complete: introduced helpers (`matches`, `createRoute`) in `handleClarificationFollowUp` to reduce repetition; BEFORE/AFTER live baseline parity (15/15; 2 expected fallbacks), exhaustive runs saved under `results/sonar-fixes/L1886/`.

# Next Targets (largest first) - Updated from SonarQube Analysis

## COMPLETED (12 functions):
✅ L1886, L3049, L3210, L3514, L3637, L2713, L5505, L5656, L1145, L1258, L2784, L2521

## REMAINING TARGETS (12 functions):

### Batch A - Critical/High Priority (4 functions):
1) chat.js L4474  (from 273 → 15, +258) — **CRITICAL** - handleChatRequest
2) chat.js L536   (from 82 → 15, +67) — **HIGH** - detectIntent  
3) chat.js L1939  (from 72 → 15, +57) — **HIGH** - generateClarificationQuestion
4) chat.js L3039  (from 70 → 15, +55) — **HIGH** - getArticleAuxLinks

### Batch B - Medium Priority (5 functions):
5) chat.js L3303  (from 65 → 15, +50) — **MEDIUM**
6) chat.js L3611  (from 59 → 15, +44) — **MEDIUM** 
7) chat.js L3133  (from 54 → 15, +39) — **MEDIUM**
8) chat.js L3737  (from 48 → 15, +33) — **MEDIUM**
9) chat.js L1528  (from 42 → 15, +27) — **MEDIUM**

### Batch C - Low Priority + Bug Fix (3 functions):
10) chat.js L2807  (from 17 → 15, +2) — **LOW**
11) chat.js L2574  (from 16 → 15, +1) — **LOW**
12) chat.js L3923  — **BUG FIX** - Function return consistency

### Frontend Targets (9 functions):
13) chat.html L1064 (from 30 → 15, +15) — **MEDIUM**
14) chat.html L1228 (from 30 → 15, +15) — **MEDIUM**
15) chat.html L1737 (from 27 → 15, +12) — **MEDIUM**
16) chat.html L948  (from 20 → 15, +5) — **MEDIUM**
17) chat.html L840  (from 16 → 15, +1) — **LOW**
18) chat.html L1686 — **STYLE** - Function nesting
19) chat.html L1833 — **STYLE** - Function nesting  
20) chat.html L1702 — **STYLE** - Prefer .dataset
21) chat.html L1725 — **STYLE** - Prefer .dataset

# Workflow (repeat per target)

1) Branch: `git checkout -b sonar/complexity-chat-L<line>-<a|b>`
2) BEFORE captures:
   - Live UI baseline: `node test-live-chat-interface.js`
   - Exhaustive (depth 5): `node scripts/exhaustive-clarifications.js --max-depth 5 --out results/sonar-fixes/L<line>/before`
3) Refactor minimally (pure helpers/early-returns/lookup tables). Preserve behavior, constants, and logging keys.
4) Merge & deploy to main; wait 30s.
5) AFTER captures:
   - Live UI baseline: `node test-live-chat-interface.js`
   - Exhaustive (depth 5): `node scripts/exhaustive-clarifications.js --max-depth 5 --out results/sonar-fixes/L<line>/after`
6) Compare before vs after; if equal or better → commit with:
   `refactor(chat): reduce complexity at L<line> (no behavior change)`
   and append an Update entry in `notes/store/AI_TODO.md`.
7) If any regression → `git reset --hard` to baseline, note failure in AI_TODO, stop unattended mode.

# Guardrails

- One target per patch; patch size ≤ 200 lines preferred.
- No business-rule reordering without proof of equivalence (test parity).
- Keep external shapes stable; preserve logs and response keys.
- Validate JSON-LD if touched: `npm run validate:all`.

# Reference

- Live API: `https://alan-chat-proxy.vercel.app/api/chat`
- Live UI:  `https://alan-chat-proxy.vercel.app/chat.html`
- Baseline runner: `test-live-chat-interface.js`
- Exhaustive runner: `scripts/exhaustive-clarifications.js`
