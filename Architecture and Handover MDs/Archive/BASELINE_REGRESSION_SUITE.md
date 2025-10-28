---
doc: baseline_regression_suite
title: Baseline Regression Suite (15 Questions)
version: 1.0
owner: alan@alanranger.com
links:
  - AI_TODO: ../AI_TODO.md
  - Handover Template: ./HANDOVER_SCRIPT_TEMPLATE.md
purpose: >
  Fixed, repeatable set of queries to detect regressions when refactoring or
  applying Sonar fixes. Must be run before/after any change that touches chat.js,
  ingestion, event rendering, or JSON-LD generation.
change_gate: true
last_reviewed: 2025-10-16
---

# Baseline Regression Suite (15 Questions)

Run these **exact questions** before *and* after any code change.  
Compare outputs for **content parity**, **structure**, and **key fields** (URLs, titles, dates, prices, locations).

> Tip: Keep baseline and after-run outputs in `results/` as JSON/HTML so we can diff.

---

## Test Set

| # | Category | Query | Expected Response Pattern (acceptance hints) |
|---|---|---|---|
| 1 | General Policy | **What is your refund and cancellation policy?** | Short summary; link to Terms/Policy page on alanranger.com; no hallucinated fees. |
| 2 | Course Event | **When is the next Lightroom course in Coventry?** | One or more **course events** with title, date(s), location; working URL to the course page. |
| 3 | Workshop Event | **Do you still run Lake District photography workshops?** | Workshop tiles/list; next available dates or “join waitlist” if none; valid page URL. |
| 4 | Product (Course) | **How much is the Lightroom beginners course?** | Price (or range) and CTA link; no currency mismatch; avoid stale prices. |
| 5 | Service (1-to-1) | **Can I book a 1-to-1 mentoring session with Alan?** | Availability/format/price (if public) + booking/contact path; links work. |
| 6 | Article | **Do you have tips for composition or leading lines?** | One or more **blog/article** links; short preview; titles must match site. |
| 7 | Article | **Show me an article about the exposure triangle.** | At least one relevant article; avoid generic web content; site links only. |
| 8 | Technical | **How do I set ISO manually on my camera?** | Concise steps; avoids brand-specific assumptions; suggests practice guidance. |
| 9 | Technical | **What’s the difference between aperture and shutter speed?** | Correct definitions; examples; no contradictions; avoids heavy jargon. |
| 10 | Advice | **When is the best time of day for landscape photography?** | “Golden hour/blue hour” guidance; weather caveats; practical tips. |
| 11 | Logistics | **Where do your workshops meet and start from?** | Meeting point policy; typical locations or “see event page” link; no stale venues. |
| 12 | Logistics | **Do you provide transport or accommodation?** | Clear policy; if residential, explain B&B/partner options; avoids over-promising. |
| 13 | Photography Academy | **How do I join the Photography Academy?** | Join path/URL; brief value prop; next intake if applicable. |
| 14 | Photography Academy | **How do module exams and certificates work?** | Assessment flow; pass criteria; certificate details; link to Academy overview. |
| 15 | About/General | **Who is Alan Ranger?** | Short bio; specialties; link to About page; avoids invented accolades. |

---

## Run Instructions (quick)

### Option A — Testbench (recommended)
1. Open `testbench-pro.html` (or `testbench-chat.html`) in your repo preview.
2. Paste each query and **copy/save** the full responses to `results/baseline-YYYYMMDD.json` (before) and `results/after-YYYYMMDD.json` (after).

### Option B — cURL loop (headless)
Create `scripts/run-queries.sh` (example), then run it from repo root:

```bash
# BEFORE changes
bash scripts/run-queries.sh queries/baseline-15.md results/baseline-$(date +%F).json

# AFTER changes
bash scripts/run-queries.sh queries/baseline-15.md results/after-$(date +%F).json
---

## Exhaustive Clarification Path Testing (all branches)

When a response asks a follow-up question and offers choices (2–5 options), we must test **every branch**.  
This runner explores all clarification paths with a depth limit and saves results for diffing.

### How to run

```bash
# BEFORE your change
node scripts/exhaustive-clarifications.js \
  --queries queries/baseline-15.json \
  --out results/baseline-clarifications-$(date +%F)

# AFTER your change
node scripts/exhaustive-clarifications.js \
  --queries queries/baseline-15.json \
  --out results/after-clarifications-$(date +%F)
