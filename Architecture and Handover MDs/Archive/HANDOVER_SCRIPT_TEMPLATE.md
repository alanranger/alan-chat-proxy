---
title: "AI Handover Script Template"
project: "Alan Ranger – Chat AI Bot"
maintainer: "Alan Ranger"
category: "Governance / Handover"
last_updated: "2025-10-16"
purpose: >
  Master handover and continuity script for AI assistants (Cursor, ChatGPT, etc.) 
  working on the Alan Ranger Chat AI Bot repository. 
  Ensures safe continuation of SonarQube fixes and validation workflows across threads.
tags:
  - Cursor AI
  - MCP
  - SonarQube
  - Validation Workflow
  - Governance
  - Chat AI Bot
handover_policy:
  trigger: "When Cursor AI chat thread becomes slow, inconsistent, or milestone is completed."
  next_action: "Generate summary and continue in new thread following the defined workflow."
  context_sources:
    - "notes/AI_TODO.md"
    - "Architecture and Handover/HANDOVER_SCRIPT_TEMPLATE.md"
---

# 🧩 Quick-Reference Checklist (for Daily Use)

### When Chat Starts to Slow Down:
1. Say:  
   **“Generate handover script for new chat thread.”**  
   → Cursor will summarise all tasks and copy key steps here for the next chat.
2. Copy its Markdown output → paste into a new Cursor thread.
3. Title new chat:  
   **“Phase # — Sonar Tier X (Description)”**

---

### Daily Fix Loop
**For each Sonar issue:**

1. Create branch:  
   `sonar/<rule>-L<line>-<short-description>`
2. Read Sonar panel → open line.
3. Explain cause in 1–2 lines.
4. Run **10 baseline tests** via `/public/chat.html`.  
   Save results → `/results/sonar-fixes/baseline/`.
5. Propose and show diff (only for that finding).  
   Apply via `fs-rw`.
6. Run **10 after-patch tests**, save → `/results/sonar-fixes/after/`.
7. Compare baseline vs after.  
   ✅ If same or better → commit → merge → note result.  
   ❌ If worse → rollback and note failure.
8. Add entry to `notes/AI_TODO.md`:  
   `- 2025-10-17 — Fixed S2681 at chat.js:L4893. Baseline matched.`

---

### 10 Standard Prompts to Re-test
1. What residential workshops are available next spring?  
2. Do your multi-day courses include B&B and meals?  
3. Tripod advice: which head for landscapes on windy hills?  
4. Find a one-day beginner workshop near Hertfordshire.  
5. Do you teach private 1-to-1 camera lessons?  
6. Which workshops are best for long-exposure seascapes?  
7. How much does a typical tripod setup cost for beginners?  
8. Show me upcoming weekend courses with free spaces.  
9. Is there an intermediate follow-up after the beginner class?  
10. What’s included in the price—tuition only or accommodation too?

---

### Commit Format
fix(sonar): <rule> at chat.js:L<line> – short description

yaml
Copy code

---

### Folder Layout
/results/sonar-fixes/baseline/
/results/sonar-fixes/after/
/results/sonar-fixes/logs/
/notes/AI_TODO.md

yaml
Copy code

---

### Guardrails
- One issue per patch.  
- Always diff + explain.  
- Run baseline/after tests.  
- Rollback on regression.  
- Keep JSON-LD validation passing.  
- Never edit unrelated files.

---

# 🧠 Full Reference Template (for Continuity)

### Context
Fix SonarQube issues in `/api/chat.js` without breaking live chat logic.

### Tools
| Tool | Purpose |
|------|----------|
| fs-ro / fs-rw | Read & write files |
| code-search | Locate functions or rules |
| shell | Run `npm run validate:all` |
| GitKraken | Branch & commit |
| notes | Update AI_TODO.md |

### Test Paths
| Type | Folder |
|------|---------|
| Baseline | `/results/sonar-fixes/baseline/` |
| After | `/results/sonar-fixes/after/` |
| Logs | `/results/sonar-fixes/logs/` |

### Priority Order
**Tier 1 — Correctness**
- S2681 – Unconditional branches  
- S1871 – Duplicate code block  
- S2486 – Missing try/catch  
- S1854 – Useless assignment  

**Tier 2 — Readability**
- S7773 – Use `Number.isNaN`  
- S7728 – Replace `.forEach` with `for…of`  
- S6582 – Optional chaining  
- S7781 – Use `replaceAll` safely  

**Tier 3 — Complexity**
- Reduce long nested logic (start L3646 or L539).  

### Handover to New Cursor Chat
When ready to migrate threads:
> “Load project context from `HANDOVER_SCRIPT_TEMPLATE.md` and `notes/AI_TODO.md`.  
> Summarise current progress and continue from the next pending Sonar rule,  
> following all guardrails and test workflows defined here.”

---

**Last Updated:** 2025-10-16  
**Maintainer:** Alan Ranger  
**File:** `/Architecture and Handover/HANDOVER_SCRIPT_TEMPLATE.md`