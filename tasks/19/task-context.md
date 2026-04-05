# Task Context — Issue #19

| Field         | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| Issue         | #19                                                                |
| Title         | Task 18: Frontend dependencies + Tailwind + Vite config            |
| URL           | https://github.com/bobpps/sound-lab/issues/19                      |
| Labels        | frontend, infrastructure                                           |
| Branch        | `feat/19-frontend-deps-tailwind`                                   |
| Worktree path | `.claude/worktrees/feat/19-frontend-deps-tailwind`                 |

## Description

Phase 6: Frontend Infrastructure (1/3). Install all frontend dependencies, configure Tailwind CSS, set up Vite proxy to backend.

## Steps from Issue

1. Install runtime deps: `react-router-dom @tanstack/react-query zustand react-hook-form @hookform/resolvers zod clsx`
2. Install dev deps: `tailwindcss @tailwindcss/vite`
3. Configure Vite — add Tailwind plugin + API proxy (`/api` → `http://localhost:3000`, strip `/api` prefix)
4. Replace `index.css` with `@import "tailwindcss";`
5. Delete `App.css`
6. Verify dev server starts: `npm run dev`

## Acceptance Criteria

- `npm run dev` starts without errors
- Tailwind classes work in components
- `/api/*` requests are proxied to backend

## Files to Modify

- `frontend/package.json` — add dependencies
- `frontend/vite.config.ts` — Tailwind plugin + proxy config
- `frontend/src/index.css` — replace with Tailwind directives
- `frontend/src/App.css` — delete

## Related Context

- Reference plan: `docs/plans/2026-04-04-full-project-plan.md` — Task 18
- Frontend CLAUDE.md specifies: Tailwind CSS preferred, `@tailwindcss/vite` for Vite integration, proxy config `server.proxy: { '/api': { target: 'http://localhost:3000' } }`
- React Compiler is active — no manual memoization needed
- ESM everywhere — `.js` extensions on imports
