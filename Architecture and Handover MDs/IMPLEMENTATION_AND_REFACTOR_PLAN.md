# IMPLEMENTATION_AND_REFACTOR_PLAN.md

> Consolidated from: CONTENT_BASED_REFACTOR_PLAN.md, CONFIDENCE_SCORING_IMPROVEMENT_PLAN.md, FORMATTING_UX_IMPROVEMENTS.md, OPTION_A_IMPLEMENTATION_PLAN.md, OPTION_C_IMPLEMENTATION_PLAN.md

## 1. Goals
- Improve scoring logic stability and transparency
- Reduce complexity and duplication in `api/chat.js`
- Preserve UX/formatting consistency across outputs

## 2. Current Constraints
- Cursor sandbox (no root folder creation by agent)
- ESLint complexity caps
- Standing rules

## 3. Workstreams
- Scoring & confidence
- Extraction & parsing (products/events)
- UI/formatting polish
- Performance & caching

## 4. Milestones
- M1: Stabilize scoring heuristic
- M2: Refactor long functions into helpers
- M3: Update tests and baselines

## 5. Risks & Mitigations
- Regression risk → strengthen baseline/CI
- Drift in handover docs → centralize updates