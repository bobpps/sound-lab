# Execution Log -- Issue #21: App Shell (Routing, Layout, Sidebar)

## Phase: Research (complete)

### 2026-04-06 -- Initial research

**Read project guidance:**
- Root `CLAUDE.md` -- ESM everywhere, TDD default, Playwright verification
- `frontend/CLAUDE.md` -- Feature-based structure, no barrel files, React Router v7 with layout routes, Tailwind CSS, TanStack Query, React Compiler active (no useMemo/useCallback)

**Read current frontend state:**
- `main.tsx` -- renders `<App />` in `<StrictMode>`, imports `index.css`
- `App.tsx` -- full Vite boilerplate (counter, logos, social links). Imports `./App.css` (note: `App.css` file does NOT exist in worktree -- import was already removed). Uses `useState`, `reactLogo`, `viteLogo`, `heroImg`. Needs complete rewrite.
- `vite.config.ts` -- `@vitejs/plugin-react` + `@tailwindcss/vite` plugins, proxy `/api` to `localhost:3000` with path rewrite. Ready to go.
- `index.css` -- only `@import "tailwindcss"` (one line). Vite boilerplate CSS was already stripped.
- `lib/api-client.ts` -- typed fetch wrapper with `ApiError` class, `get`/`post`/`put`/`delete`/`fetchRaw`. From issue #20.
- `types/api.ts` -- read-model types for Provider, Dialog, AnnotatedDialog, AnnotationPrompt, AgentPrompt, Voice, ApiErrorResponse. From issue #20.

**Checked for App.css:** Not present in worktree. No cleanup needed.

**Checked assets directory:** Contains `hero.png`, `react.svg`, `vite.svg` (Vite starter assets). Will remain unused after App.tsx rewrite.

**Read tsconfig.app.json:**
- `allowImportingTsExtensions: true` -- can use `.tsx`/`.ts` extensions in imports
- `verbatimModuleSyntax: true` -- must use `import type` for type-only imports
- `erasableSyntaxOnly: true` -- no enums, no parameter properties
- `noUnusedLocals: true`, `noUnusedParameters: true` -- strict unused checks

**Read package.json deps:**
- `react-router-dom@^7.14.0` -- installed (also installs `react-router` as dependency)
- `@tanstack/react-query@^5.96.2` -- installed
- `clsx@^2.1.1` -- installed (for className composition)
- `tailwindcss@^4.2.2` + `@tailwindcss/vite@^4.2.2` -- installed

**Reviewed dependency (issue #20):** Completed. API client and types are in place. Vite proxy configured.

**Researched React Router v7 patterns (via context7 docs):**
- Declarative mode: `BrowserRouter` + `Routes` + `Route` JSX tree
- Layout routes: `Route` with `element` but no `path` (or with `path`), children render via `<Outlet />`
- Redirect: `<Navigate to="/datasets" replace />`
- NavLink: `className={({ isActive }) => ...}` callback for conditional styling
- Import source: `"react-router"` (canonical in v7, re-exported by `react-router-dom`)

**Key decisions documented in analysis.md:**
- Declarative BrowserRouter mode (not createBrowserRouter data mode)
- Layout route wrapping all pages, with `<Outlet />` in AppLayout
- Placeholder pages in `frontend/src/pages/` (flat, throwaway)
- Dark sidebar with Tailwind v4 utility classes (no config file needed)
- Module-level `QueryClient` in App.tsx
- NavLink with `className` callback + `clsx` for active state
- Import from `"react-router"` (not `"react-router-dom"`)
- index.css: keep `@import "tailwindcss"`, add `html/body/#root` height reset

## Phase: Implementation (pending)

### Files to create (in order):
1. `frontend/src/index.css` -- add base height styles
2. `frontend/src/components/layout/Header.tsx`
3. `frontend/src/components/layout/Sidebar.tsx`
4. `frontend/src/components/layout/AppLayout.tsx`
5. `frontend/src/pages/DatasetsPage.tsx`
6. `frontend/src/pages/TtsPage.tsx`
7. `frontend/src/pages/RealtimePage.tsx`
8. `frontend/src/pages/ProvidersPage.tsx`
9. `frontend/src/router.tsx`
10. `frontend/src/App.tsx` (rewrite)

### Verification steps:
- `npx tsc -b --noEmit` (type check)
- `npx eslint .` (lint)
- Playwright: open app, verify sidebar renders, navigation works, no console errors
