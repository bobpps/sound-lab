# Task Context — Issue #21

## Issue
- **Number:** 21
- **Title:** Task 20: App shell (routing, layout, sidebar)
- **URL:** https://github.com/bobpps/sound-lab/issues/21
- **Labels:** frontend, infrastructure
- **State:** OPEN

## Branch & Worktree
- **Branch:** `feat/21-app-shell`
- **Worktree:** `.claude/worktrees/feat/21-app-shell`
- **Base:** `origin/main` (rebased 2026-04-06)

## Description
Create the app shell: React Router with layout routes, sidebar navigation, and header. Classic admin panel layout.

## Requirements
- Create `frontend/src/router.tsx` — BrowserRouter config
- Create `frontend/src/components/layout/AppLayout.tsx` — flex layout
- Create `frontend/src/components/layout/Sidebar.tsx` — nav links
- Create `frontend/src/components/layout/Header.tsx` — top bar
- Rewrite `frontend/src/App.tsx` — RouterProvider + QueryClientProvider
- Routes: `/` redirect to `/datasets`, `/datasets/*`, `/tts`, `/realtime`, `/providers` with placeholders
- Sidebar: NavLink items (Datasets, TTS Testing, Realtime, Providers), active state, fixed left (w-60, dark bg)
- Header: top bar with "Local Mode" text
- Verify via Playwright

## Acceptance Criteria
- Classic admin panel layout: fixed sidebar + header + content
- Navigation between pages works
- Active nav item highlighted
- Placeholder content shown on each page

## Dependencies
- #20 (API client + shared types) — CLOSED, merged
- #19 (frontend deps + Tailwind) — implicitly done: deps installed

## Current Frontend State
- All deps installed: react-router-dom v7, @tanstack/react-query, tailwindcss, zustand, react-hook-form, zod
- Vite config has tailwindcss plugin + API proxy to localhost:3000
- `index.css` has `@import "tailwindcss"`
- `api-client.ts` and `types/api.ts` exist from #20
- `App.tsx` is still Vite boilerplate starter template
- `main.tsx` renders `<App />` in `<StrictMode>`
- No routing, no layout components yet

## Technology Stack (from frontend/CLAUDE.md)
- React Router v7 (layout routes, `<Outlet />`)
- Tailwind CSS for styling
- TanStack Query for server state
- Feature-based directory structure
- No barrel files, no cross-feature imports

## Relevant Files
- `frontend/package.json` — deps already installed
- `frontend/vite.config.ts` — tailwind + proxy configured
- `frontend/src/App.tsx` — rewrite target
- `frontend/src/main.tsx` — may need changes
- `frontend/src/index.css` — tailwind import present
- `frontend/src/lib/api-client.ts` — existing API client
- `frontend/src/types/api.ts` — existing shared types
- `frontend/CLAUDE.md` — architecture guidance
