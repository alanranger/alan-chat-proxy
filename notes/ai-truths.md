# AI Truths — Chat AI Bot
_Last updated: 2025-10-16_

Purpose: persistent local rules for THIS repo so the model stops forgetting and doesn’t loop.

## Project Rules
- **Validation Gate**: After generating or editing any JSON-LD, save under `/generated/` and run `npm run validate:all` (or MCP tool `npm_validate_all`). Do not apply/commit until it passes.
- **Patch Discipline**: Propose a **single unified git patch** for changes. If eslint/prettier/TypeScript fail, fix within the same patch.
- **Search First**: Use `code-search` to list all references (paths + counts) before editing.
- **Safe FS**: Use `fs-ro` for reading; only toggle `fs-rw` ON to apply a patch, then OFF again.
- **DB Safety**: Prefer `postgres-ro` for inspection. Only use `postgres-rw` (Supabase write) when explicitly requested.

## JSON-LD Must-Haves (Events)
- Include: `image`, `organizer`, `location.address`, `offers.validFrom` (set equal to `startDate`).
- Datetimes must be ISO 8601 with timezone (e.g., `2025-12-01T09:00:00+00:00`).

## ItemList Must-Haves
- `itemListElement` positions start at **1** and increase by 1 in display order.
- Each element is a `ListItem` with either a `url` OR an inline `item` object.

## Organizer Defaults (for examples/tests)
- name: **Alan Ranger Photography**
- url: https://www.alanranger.com/
- logo: https://images.squarespace-cdn.com/content/v1/5013f4b2c4aaa4752ac69b17/b859ad2b-1442-4595-b9a4-410c32299bf8/ALAN+RANGER+photography+LOGO+BLACK.+switched+small.png?format=1500w
- address: **45 Hathaway Road, Tile Hill Village, Coventry, CV4 9HW**

## Never Do
- Never apply patches without running validators/linters.
- Never write to production DB unless explicitly asked.
- Never skip the “search first” step.
