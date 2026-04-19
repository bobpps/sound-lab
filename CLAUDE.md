# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sound Lab — internal tool for testing TTS providers, realtime voice agents, and managing dialog datasets. Full-stack TypeScript monorepo: Fastify 5 backend + React 19 frontend, dual DB (SQLite local / Supabase Postgres).

## Commands

```bash
npm install                                    # install
npm run dev                                    # backend:3000 + frontend:5173
npm run build                                  # build all
npm test                                       # tests
npm run test:watch --workspace=backend         # tests (watch)
npm run lint --workspace=frontend              # lint
npx vitest run tests/db/dialogs.test.ts        # single test (run from backend/)
```

## Structure

npm workspaces: `backend/`, `frontend/`. Root orchestrates via `concurrently`. ESM everywhere (`"type": "module"`, `.js` extensions in imports).

## Important Rules

- **Write GitHub issues in English.** Issue titles and descriptions must be in English, even when the surrounding conversation is in another language.
- **Fix causes, not symptoms.** When debugging, before deciding on a fix, ask: "Is this the root cause or a consequence?" Always trace to the root cause.
- **When in doubt, ask.** If unsure about intent, approach, or scope — ask the human before proceeding.
- **Use subagents liberally.** Offload research, exploration, code review, and parallel tasks to subagents. Keep the main context clean for decisions and implementation.
- **TDD by default.** Write tests first, then implement. Red → Green → Refactor.
- **Verify UI with Playwright.** After every UI-related task, open the page in Playwright browser, take a screenshot to confirm the result matches expectations, and check the browser console for errors/warnings.
