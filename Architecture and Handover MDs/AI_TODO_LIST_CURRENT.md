# 🧠 AI_TODO_LIST_CURRENT.md  
_Last updated: 28 Oct 2025_  
_Alan Ranger — Chat AI Bot / alan-chat-proxy_

---

## 🧩 Overview
This file replaces the old `AI_TODO_LIST_2025-01-23.md` as the **current active scratchpad** for ongoing development.  
It is used for:
- Tracking live development tasks  
- Recording fixes or adjustments made inside Cursor AI  
- Maintaining a lightweight progress record between sessions  

All older references or notes can be found inside `/Archive/AI_TODO_LIST_2025-01-23.md`.

---

## ✅ Recently Completed (Last 2 Weeks)
| Date | Completed Item | Notes |
|------|-----------------|-------|
| 28 Oct 2025 | **Baseline Testing & Analysis** | 28-question baseline captured with full responses; quality issues identified (inconsistent response styles, missing related info) |
| 28 Oct 2025 | **Test Script Path Fixes** | Updated quality-benchmark-test.cjs to save to correct `/testing-scripts/test results/` directory |
| 28 Oct 2025 | **XLSM to JSON Conversion** | Created script to convert routing analysis spreadsheet to JSON format |
| 28 Oct 2025 | **Interactive Testing Analysis** | Analyzed scoring criteria and response quality patterns from interactive-testing.html |
| 24–28 Oct 2025 | Major documentation cleanup | All .md files consolidated, archive created, new master handover set deployed |
| 22–28 Oct 2025 | Cursor AI & MCP environment setup | Config verified; redundant folders handled manually |
| 20–27 Oct 2025 | Testing framework reorganisation | `testing-scripts/` now hosts all test .js; results stored in `test results/` subfolder |
| 20–27 Oct 2025 | Debug modules confirmed working | Debug scripts verified and timestamped up to 24 Oct |
| 18–24 Oct 2025 | chat.js logic improvements | Refinements to scoring and confidence handling; new matching rules applied |

---

## 🚧 Active Tasks (Current Focus)
| Priority | Task | Description | Owner | Status |
|-----------|------|--------------|-------|--------|
| 🔸 High | **chat.js Complexity Refactoring** | Reduce 3 high-severity functions to ≤15 complexity while maintaining exact response behavior | Cursor | In Progress |
| 🔸 High | **Baseline Testing Complete** | 28-question baseline captured with full responses for regression testing | Cursor | ✅ Complete |
| 🔸 High | **Test Script Path Updates** | All testing scripts now save to `/testing-scripts/test results/` correctly | Cursor | ✅ Complete |
| ⚙️ Medium | **Interactive Testing Check** | Verify if interactive-testing.html has dual scoring system (Bot Response + Related) | Cursor | Pending |
| ⚙️ Medium | **Review Debug Scripts** | Identify duplicates and propose merges where safe. | Cursor | Pending |
| 🪄 Low | **Response Composer Layer** | Future: Add final layer to unify response styles (conversational vs data dumps) | Future | Planned |

---

## 🧱 Backlog / Future Enhancements
| Type | Item | Intent |
|------|------|--------|
| Refactor | Modularise `compare-test-results.js` | Simplify result aggregation and reduce duplication. |
| Refactor | Extract helpers from `debug-comparison-logic.cjs` | Reuse across tests and comparison tools. |
| Enhancement | Link test IDs ↔ results | Let chat.js reference script outcomes dynamically. |
| Enhancement | Confidence scoring visualisation | Add metric overlay in debug panels. |
| Governance | Mini‑Batch tracker | 1–2 hr task grouping for Cursor auto‑sync. |

---

## 🧭 Next Sync Notes for Cursor AI
When opening this project in Cursor:
1. Load **this file** first.  
2. Then open **`/api/chat.js`**.  
3. Then open **`/testing-scripts/compare-test-results.js`** and **`/debugs/debug-comparison-logic.cjs`**.  
4. Confirm outputs appear in **`/testing-scripts/test results/`**.  
5. Log any inconsistencies here under “Active Tasks”.

---

## 🗂 Folder References
- **/api/** → main logic files (especially `chat.js`)
- **/testing-scripts/** → test logic and baselines  
- **/debugs/** → diagnostic helpers  
- **/Architecture and Handover MDs/** → documentation + handover  
- **/Archive/** → old .md files and past notes  

---

## 🧩 Notes
This scratchpad is intentionally lightweight.  
Do not delete or rename this file between Cursor syncs — it acts as your working memory anchor.
