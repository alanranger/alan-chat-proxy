# Automation defaults for this project

## Python
- Use the venv at `.venv`.
- Format with **Black** on save.
- Lint and organize imports with **Ruff** (`ruff --fix`) before formatting.
- Create minimal config files automatically if missing; do not prompt.

## JavaScript / TypeScript (if present)
- Prettier is the only formatter; ESLint does linting.
- Use existing lockfile to choose package manager (pnpm > yarn > npm).

## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point restore-20260116-1948.
