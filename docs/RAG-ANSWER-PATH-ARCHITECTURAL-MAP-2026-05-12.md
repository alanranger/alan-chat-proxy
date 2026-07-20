# RAG / Chat Answer-Path Architectural Map (`alan-chat-proxy`)

**Scope:** Read-only investigation of the Chat AI Bot codebase (primarily `api/chat.js`, `regression-test-suite.js`).  
**Evidence date in repo:** commits visible via `git blame` on cited lines where noted.

---

## 1. Path inventory

Each row is a **distinct way** prose can reach the HTTP response (`res.status(200).json(...)` patterns are spread across helpers; several paths bypass `sendRagSuccessResponse`).  
**Important:** No external LLM completion path surfaced in `api/chat.js`; answers are predominantly **deterministic/heuristic/template + Supabase-backed retrieval**.

| Path | Entry (function, file:~lines) | Triggers | Inputs consumed | Primary output shape | Representative query (informal) |
|------|-------------------------------|----------|-------------------|----------------------|--------------------------------|
| **A — Workshop classifier** | `handleQueryClassification` → `handleWorkshopClassification`; `handler` routes via `processMainQuery` (~11237–11375, ~7856+) | `classifyQuery(...) === workshop` (+ payment-plan guards reroute elsewhere) | Query, extracted keywords | Event-style answer from `handleEventsPipeline` (~7013+) | “When’s the next Devon workshop?” |
| **B — Clarification classifier** | `handleQueryClassification` → `handleClarificationClassification` → `handleClarificationQuery` (~11398+, ~7349+) | `classifyQuery` → `clarification` | Query, classification | Fixed JSON (`options`, short question) | Follow-up taxonomy questions |
| **C — Specific early answers** | `handleSpecificQueryAnswers` (~8214+) | Regex blocks (astro workshops, hire Coventry, certificates, gear for workshop, etc.) | Query, conditional `findEvents`/`findArticles` | Hand-coded markdown strings + optional `structured` | Matched scripted FAQs |
| **D — Contact-Alan scripted** | `checkContactAlanQuery` (~8346+) | Subset regex list | Query | Fixed low-library answer + pills | Scripted “best course” ambiguity |
| **E — Technical block (canonical strings)** | `getTechnicalAnswers` (~1454+), called from `handleTechnicalQueryRouting` → `handleTechnicalQueries` (~11079–11102, ~10994+) | `isTechnicalQueryType` (~10293+) **or** `businessCategory` `Technical Photography Concepts`/`Technical Advice` when `technicalResponse !== null`; free-course carve-out | Lowercased query; optionally `findArticles` + enrichment | Concatenated `**Bold** …` prose from many small getters + optional substitution via `enrichTechnicalAnswerWithArticles` (~10930+) | **“Best camera beginners”**, **“best time … landscape”** (see §3) |
| **F — Service retrieval + synthesis** | `handleServiceQueries` (~10843+), `generateServiceAnswer` (~4268+) | `handleServiceAndEventRouting` before events when `!isTechnicalQuery` (~11174+); repeated via payment-plan and pipeline branches | Keywords, landing pages from DB | Bullet/list style or generic “range of photography services…” (~4294–4300) | Broad “what services” |
| **G — Events shortcut** | `handleEventRoutingQuery` (~10466+), uses `prefersEducationOverEventShortcut` / `shouldRouteToEvents` etc. (~10495+, ~10341+) | Scheduling/listing cues on course/workshop language | Keywords, DB events | Markdown list/dates/links | Course calendar intents |
| **H — Pure RAG pipeline** | `processRagFallback` → `processRagSearchResults` → `generateRagAnswer` → `buildRagResponse` (~11030–11074, ~9682+, ~9459+) | Runs when earlier `tryRagFirst` branches return nothing | Chunks (`page_chunks`), entities, `findArticles` results, scoring | Concatenated or extracted text; entities path may use FAQs | Retrieval-led “why / how” when hooks miss |
| **H1 — Chunk “technical direct” inside RAG chunks** | `handleChunkProcessing` → `generateTechnicalDirectAnswer` → optional `extractDirectAnswerFromChunks` (~8904+, ~9006+, ~9347+) | Chunk path (`chunks.length > 0` in `generateRagAnswer` ~9477+) + “what is / how do I …” heuristic | Chunk text | `formatDirectAnswer` style `**concept** …` (~863+) or fallback `generateDirectAnswer` chain (~2065+) | “What is X” where chunk pattern matches |
| **H2 — Bird/tips shortcut** | `handleChunkProcessing` (~8910+) | Regex on query (`isBirdWildlifeTipsQuery` ~8850+) | Article-like rows passed as `entities` slot (see naming quirk below) | `composeTipsAdviceFromArticles` / hard-coded guide prose | Tips on wildlife/bird photography |
| **H3 — What-is entities path** | `generateRagAnswer` → `processEntitiesForRag` → `handleRegularEntityProcessing` (~9472+, ~9424+, ~9371+) | Entities present + “what is” | Entities, chunks (for corpus gate), JSON-LD | FAQ extract, curated link (`ruleOfThirdsCompositionGuideAnswer` branch ~9387+), or “Based on Alan Ranger…” wrapper (~9406+) | Concept Qs tied to seeded entities |
| **I — RAG success envelope** | `sendRagSuccessResponse` (~12191+); uses `composeFinalResponse` (~12745+) | `attemptRagFirst` succeeds (`processMainQuery` ~11297+) | Existing `answer`, `sources`, enriched `structured` | Wrapped/tweaked prose + confidence adjusted via `performQualityAnalysis` (~12201+, ~12082+) | Successful retrieval answers |
| **J — Fallback intent stack** | `handleRagFallbackWithIntent` → `determineIntent` → `processByIntent` (~12273–12373+) | Low-confidence / failed rag result from `attemptRagFirst` | Classification + pageContext | Workshops (`handleWorkshopIntent`), services, `handleDirectAnswerOrWorkshop` | Non-RAG salvage |
| **K — Legacy direct_answer + evidence** | `handleDirectAnswerClassification` → `handleDirectAnswerQuery` (~12439+) → optionally `handleFallbackSystem`/`handleFallbackResponse` (~7327+) | Classification `direct_answer` under `intent` replay | Articles/services/events lookups | **Article prose** (`generateArticleAnswer`, ~7658+) or **`generateEvidenceBasedAnswer`** (~7725+) | Old pipeline safety net |
| **L — Payment-plan literals** | Many branches (~11032+, ~11343+, ~12298+) | Regex on instalments | None / services lookup | canned paragraph | Financing questions |

### Naming quirk observed

`processChunksForRag` passes `articles` from `results.articles` into `handleChunkProcessing`’s second parameter labelled `entities` (`api/chat.js` ~9443–9446), whilst actual RAG **`results.entities`** are separate. Behaviour is readable from call sites (~11063–11068) but is easy to misread when auditing.

---

## 2. Routing diagram (summary)

Rough order **inside `tryRagFirst`** (~11199–11253):

1. `handleSpecificQueryAnswers` (scripted FAQs) → return if matched.
2. `checkContactAlanQuery`.
3. `handleTechnicalQueryRouting`: builds `technicalResponse = getTechnicalAnswers(qlc)` (~11081); `isTechnicalQueryType(...)` (~10293+); if true → **`handleTechnicalQueries`** and **exit** (~11086–11095).
4. **`handleSpecificQueryTypes`** (~11144+) (contact pages, vouchers, Alan bio, **`handleEquipmentQuery`**, laptops, syllabus weeks, cancellations, certificates, …).
5. **`handlePaymentPlanRouting`**.
6. **`handleServiceAndEventRouting`** (~11175+): if **not** `isTechnicalQuery`, **`handleServiceQueries`** first on success exits; **else** skips; then **`handleEventRoutingQuery`**; if still nothing and **`isTechnicalQuery`** (but step 3 did not succeed — e.g. `handleTechnicalQueries` returned null) **`handleTechnicalQueries` again**.

If all return null: **`processRagFallback`** (full RAG: chunks/entities/articles → `generateRagAnswer`).

**Above `tryRagFirst`**, `processMainQuery` (~11257+) applies:

- **`handleQueryClassification`**: payment plan → services JSON; **`workshop`** → `handleEventsPipeline` (~7013+); **`clarification`** → scripted clarifications (~11398+).
- On success **`sendRagSuccessResponse`** (**path I**): `initializeStructuredObject` → `handleSourcesConversion` (~12053+) → `enrichAdviceWithRelatedInfo` → **`composeFinalResponse`** → **`performQualityAnalysis`**.

If RAG flagged unsuccessful: **`handleRagFallbackWithIntent`** (**path J**) with **`classifyQuery` / `determineIntent`** branching.

---

## 3. Wordsoup root cause (IDs aligning with cited examples)

**Verdict:** Those two samples match **literally authored template strings**, not chunked LLM truncation and not `formatResponse` stripping grammar.

They are emitted by **`getTechnicalAnswers` → specialised helpers**:

| Symptom | Function | Location (`api/chat.js`) |
|---------|----------|---------------------------|
| Beginner camera “Seek manual aperture…” | `getBestBeginnerCameraAnswer` | ~1531–1534 |
| Landscape “best time” / golden hour block | `getLandscapeBestTimeAnswer` | ~1521–1523 |

`git blame` on those lines attributes them to **`7f78c0c` on 2026-05-12**. The same commit block introduced **`getLandscapeSettingsStarterAnswer`** (~1526–1528), which exhibits the **same condensed style**.

### Routing to these strings

1. `getTechnicalAnswers(qlc)` enumerates getters including the two above (`basicAnswers` array ~1456–1482, entries ~1465–1467).
2. **`handleTechnicalQueryRouting`** (~11079–11102) requires `isTechnicalQueryType` OR category match; `getTechnicalAnswers !== null` is sufficient (**~10300–10301**).
3. **`handleTechnicalQueries`** (~10994+) calls `getTechnicalAnswers`, then **`enrichTechnicalAnswerWithArticles`** may override with `generateArticleAnswer` when no “specific hardcoded” gate applies. **`hasSpecificHardcodedAnswer`** (**~10903–10919**) explicitly lists **both** landscape timing/settings **and** beginner camera — enrichment is skipped and the terse string survives when **`technicalResponse.length >= 100`** (**~10937–10939**).

So queries like **“What is the best camera for beginners”** (`what is` + matches camera/beginners + best) satisfy `getBestBeginnerCameraAnswer`. **“What is the best time of day for landscape photography”** satisfies `getLandscapeBestTimeAnswer`. **`hasSpecificHardcodedAnswer` holds true**, forcing retention of those templates.

---

## 4. Quality gate inventory

There is **no** shared “readable English” or “answers the precise question” gate on final user-visible prose.

| Area | What runs | Grammar / coherence | Question faithfulness | Confidence vs prose quality |
|------|-----------|---------------------|------------------------|----------------------------|
| **`formatResponse`** (~9075–9105) | Length trim, whitespace squeeze | No | No | N/A |
| **`enrichTechnicalAnswerWithArticles`** (~10930+) | Keyword overlap via `isArticleAnswerRelevant` (~10923+) | No | Partial (keyword heuristic) | N/A |
| **`composeFinalResponse` / enhanceCategory** (~12745+, ~12900+) | May adjust tone (`makeResponseConversational` ~12768+) | Cosmetic only; no grammatical repair guaranteed | Heuristic | Can raise `confidence` floor (~12778) regardless of readability |
| **`performQualityAnalysis` + `finalizeConfidence`** (~5695+, ~6113+) on RAG success (~12191+) | Lexical / indicator scoring | No grammatical parse | Approximate overlap | Confidence not tied to readable prose |

**LLM synthesis:** Repo search for `openai`, `anthropic`, `gpt`, etc. yielded **no** generative completions in **`api/chat.js`** (beyond static string content).

---

## 5. Regression harness (`regression-test-suite.js`)

### (a) Deploy / freshness gating?

**No.** `syncImprovementTracking` (~173–197) aligns each `content_improvement_tracking` row to the **`results` array** from **`runRegressionBatch` → `postQuestion` → immediate HTTP JSON** (~151–169; DB updates ~293–294).

It does **not**:

- SELECT the latest **`chat_interactions`** row timestamps,
- compare against a deployed revision time, or
- require an INSERT/UPDATE **after** an external deploy cue.

### (b) Does the pass heuristic reject ungrammatical output?

**Not reliably.** `evaluateAnswer` (~81–103):

| Check | Wordsoup resilience |
|-------|---------------------|
| `plainAlphaNumLen` ≥ 150 | Usually passes dense keyword strings |
| `FALLBACK_NEEDLES` | Passes unless identical to blocked templates |
| `looksLikeNavSoup` | Targets pipe-heavy / nav patterns (~55–60), unrelated |
| **`isWhatIs` + `hasDefCue`** (~94–101) | Markdown `**` can satisfy `hasDefCue`; or length ≥ 220 avoids `weak_definition` |

---

## 6. Shared vs independent outbound paths

**There is no unified outbound pipeline.** Responses issue from **many** helpers calling `res.status(200).json` directly. Only subsets pass through **`sendRagSuccessResponse` / `composeFinalResponse`**.

**Shared-ish:** `finalizeConfidence` + `analyzeResponseContent` recur on some strands (e.g. evidence synthesis ~7740+), but **not** around every responder.

---

## 7. Recommendation (single choice)

**Choose (b): keep heterogeneous retrieval routers, add one mandatory shared outbound quality validator** for every successful assistant JSON payload before `res.json`.

**Rationale:** Rewriting `tryRagFirst` / `classifyQuery` / `processByIntent` into a **single retrieval pipeline** (option a) is a large, high-regression project. The failures you cited — **trusted strings that read badly** plus **heuristic confidence drift** — are primarily **emission QA** failures. A **universal wrapper** targets that without collapsing routing. Tactical-only patching (c) demonstrably reshuffles faults between paths (§3: new surface from hardcoded blobs).

**Long-term:** Consolidation (a) may still be desirable once outbound quality is stable.

---

## 8. Uncertainties / flagged gaps

Not every `res.status(200).json` call site was enumerated. **`processRemainingLogic`** (~12490+) is referenced by `processByIntent` but was not fully expanded — treat as an **additional fork** under intent/pageContext.

---

*Document generated from read-only architectural review. No code changes in that review batch.*
