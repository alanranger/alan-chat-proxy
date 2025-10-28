# alan-chat-proxy Handover — 28 Oct 2025
_Last updated: 28 Oct 2025 16:45 by Cursor AI (session recovery and refactoring prep)_

---

## 1. Overview
This document was generated following the **loss of active chat history in Cursor** after a version update. It provides a **continuity handover** for `alan-chat-proxy`, consolidating all current structure, objectives, implementation notes, and ongoing work threads previously tracked in chat.js and related testing logic.

It is intended to serve as the **primary recovery anchor** for Cursor AI or any subsequent system reinitialization.

---

## 2. Current Directory Structure
Confirmed as of **28 Oct 2025** (post-manual restructuring):

```
Chat AI Bot/
│
├── .cursor/
├── .git/
├── .github/
├── .husky/
├── .venv/
├── .vscode/
│
├── api/
│   └── chat.js            ← Active logic under development
│
├── Architecture and Handover MDs/
│   ├── (many historical documents – some may be out of date)
│   ├── AI_TODO_LIST_2025-01-23.md
│   ├── HANDOVER_SCRIPT_2025-10-17.md
│   ├── COMPREHENSIVE_PROJECT_PLAN.md
│   ├── COMPREHENSIVE_TESTING_PLAN.md
│   └── … etc.
│
├── backup/
├── CSVs from website/
├── debugs/
│   ├── debug-comparison-logic.cjs
│   ├── debug-chat-response.js
│   ├── debug-api-response.js
│   └── (etc. — all individual debug test harnesses)
│
├── generated/
├── Icons/
├── lib/
├── migrations/
├── node_modules/
├── notes/
├── public/
├── schemas/
├── scripts/
├── sql/
│
├── testing-scripts/
│   ├── test results/                 ← All test outputs must go here
│   ├── baseline-comparison-test.js
│   ├── comprehensive-test.js
│   ├── comprehensive-live-test.js
│   ├── analyze-*.js
│   ├── capture-baseline.js
│   ├── compare-test-results.js
│   └── (etc. — full automated test suite)
│
├── tools/
└── Working Files Downloaded/
```

📎 **Note:**
Several `.md` files in `Architecture and Handover MDs` may no longer accurately reflect the current project structure or directory paths, as recent restructuring and test segregation occurred after their last update. Treat them as partially deprecated until reviewed.

---

## 3. Implementation Notes (chat.js Focus)
- Primary logic under test: **`api/chat.js`**
- This file drives the **alan-chat-proxy** Vercel endpoint.
- Active development phase: **logic correction and modularization of product/event extraction + test routing**.
- Previous improvements (Oct 2025):
  - Regex fixes for product block bullet parsing
  - Preservation of `Book Now` CTA logic (product URL only)
  - Event URL safely marked as `View Event`
  - Category and location-aware featured product selection
  - Structured JSON response validated against **baseline regression suite**

Cursor AI should continue from this file as the main reference point for reasoning, as most testing scripts and regression comparison files are designed around it.

<details>
<summary>🧩 Supplementary Context File — <code>chat-backup.js</code></summary>

### File Location
```
/Architecture and Handover MDs/Recovery Resources/chat-backup.js
```

### Purpose
This file is a **historical snapshot of `/api/chat.js` as of 6 Oct 2025**, taken before the recent structural re-organization and logic improvements.  
It is preserved **for context only** — to provide visibility into the evolution of the assistant’s logic, naming patterns, and helper structures prior to modularisation.

### Contents Overview
`chat-backup.js` includes legacy implementations of:
- Direct-answer synthesis (`generateRagAnswer`, `tryArticleBasedAnswer`, etc.)
- Technical / business intent classification  
- Confidence scoring and context ranking  
- Product / event extraction and meta description handling  
- Supabase session logging and debug utilities  
- Early helper functions for equipment, fitness level, accommodation, and pricing parsing  

### Guidance for Cursor AI
⚠️ **Do not reuse or restore any code from this file.**  
It is provided **solely for historical insight** into naming, logic lineage, and prior approach patterns.  
The current production direction and scoring logic have significantly diverged and improved since this snapshot.  
Cursor AI may reference it **for understanding context**, **not as a baseline** for reinstatement.

</details>


---

## 4. Testing Framework Alignment
- All `.js` and `.cjs` test scripts have been **moved to `/testing-scripts`**.
- All output JSON/CSV/XLSM results now write into:
  ```
  /testing-scripts/test results/
  ```
- Standard test naming:
  - Baseline comparison → `baseline-comparison-test.js`
  - Regression validation → `comprehensive-validation-test.js`
  - Full test sweep → `run-exhaustive-test.js`
- When new results are generated, ensure output directories mirror this structure.

---

## 5. Recovery Plan for Cursor AI
If chat context is lost again:

1. **Load this file first** (`HANDOVER_2025-10-28_CHAT_RECOVERY.md`) — it re-establishes project scope and rules.
2. Then read the following files in order:
   - `/Architecture and Handover MDs/AI_TODO_LIST_2025-01-23.md`
   - `/api/chat.js`
   - `/testing-scripts/baseline-comparison-test.js`
   - `/debugs/debug-comparison-logic.cjs`
3. If tests or results are missing, regenerate via:
   ```bash
   node testing-scripts/comprehensive-test.js
   ```
4. Re-sync test outputs to `/testing-scripts/test results/`
5. Cross-check with `COMPREHENSIVE_PROJECT_PLAN.md` (for project-level goals).

This ensures any future AI agent can **self-rehydrate the full project understanding** without prior chat memory.

---

## 6. Work-in-Progress Tasks
- Validate folder-aware script logic (ensure all relative imports still resolve)
- Reconnect automated result comparison (baseline vs current)
- Add support for nested JSON diff summaries
- Verify the handling of category and location filters in `chat.js`
- Review and sync out-of-date `.md` files in `/Architecture and Handover MDs`
- Update `README.md` to match post-refactor structure

---

## 7. Standing Rules
- Never hard-code product URLs or event names.
- Always write test outputs to `/testing-scripts/test results/`.
- Do not overwrite validated `.md` baselines without explicit confirmation.
- Maintain safe guards for null data and DST/BST time offsets.
- Preserve the file modularity principle: debug, testing, and api layers must stay separated.

---

## 8. <details><summary>Logs & Reference Outputs</summary>

The following content is summarized from the previously extracted `chat history.txt`, providing partial restoration of chat reasoning, test attempts, and directory corrections.

_(Truncated for brevity in this handover, but full transcript is archived as `chat history.txt` in the recovery root.)_

</details>

---

## 9. <details><summary>Historical Context & Notes</summary>

- The earlier chat session guided multiple restructuring phases:
  - Consolidation of test logic into `/testing-scripts`
  - Modularization of `chat.js`
  - Addition of bullet regex fixes in product logic
  - Migration of baseline regression comparisons
- Several test and debug runs confirmed environment correctness but failed on write permissions (Cursor sandbox limitation).
- Manual restructuring resolved the issue — now standardized.

</details>

---

## 10. ⚠️ Disclaimer about Outdated MDs
Some files within **`/Architecture and Handover MDs/`** (including `PROJECT_SUMMARY_2025-01-23.md`, `COMPREHENSIVE_TESTING_PLAN.md`, etc.) may be **partially out of date**.
Cursor or any future AI agent should **verify folder references and file paths** before using those documents as authoritative.
This handover supersedes all earlier MDs for directory and logic accuracy.

---

## 8. Current Development Status (28 Oct 2025)

### ✅ **Recently Completed**
- **Baseline Testing**: 28-question baseline captured with full responses in `testing-scripts/test results/quality-benchmark-before-2025-10-28T16-39-06-874Z.json`
- **Quality Analysis**: Identified inconsistent response styles (conversational vs article links, missing related info blocks)
- **Test Script Updates**: Fixed `quality-benchmark-test.cjs` to save results in correct directory structure
- **XLSM Conversion**: Created `xlsm-to-json.cjs` script for routing analysis data

### 🚧 **Current Focus: Complexity Refactoring**
**Target**: Reduce 3 high-severity functions in `api/chat.js` to cognitive complexity ≤15
- `extractAnswerFromArticleDescription()` (L638)
- `extractDirectAnswerFromChunks()` (L7302) 
- `generateRagAnswer()` (L7384)

**Approach**: Extract helper functions, use guard clauses, maintain identical business logic

### 🎯 **Quality Issues Identified**
- **Technical questions**: Inconsistent response styles (some conversational, some just article links)
- **Missing related info**: Technical questions often lack related articles block entirely
- **Wrong routing**: Business questions go to clarification instead of proper answers
- **Incomplete content**: Even when articles shown, better/more relevant ones missing

### 🔮 **Future Enhancement**
**Response Composer Layer**: Add final layer to unify response styles - take whatever routing produces and synthesize into consistent conversational format instead of JSON/MD dumps.

---

✅ **End of Recovery File**
