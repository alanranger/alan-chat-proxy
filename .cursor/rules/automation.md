# Automation defaults for this project

## Python
- Use the venv at `.venv`.
- Format with **Black** on save.
- Lint and organize imports with **Ruff** (`ruff --fix`) before formatting.
- Create minimal config files automatically if missing; do not prompt.

## JavaScript / TypeScript (if present)
- Prettier is the only formatter; ESLint does linting.
- Use existing lockfile to choose package manager (pnpm > yarn > npm).
