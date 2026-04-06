# Alignment Check -- Issue #21: App Shell (Routing, Layout, Sidebar)

## Original Analysis Summary

The analysis specified building 6 deliverables to replace the Vite boilerplate with a working app shell:

1. **`router.tsx`** -- React Router v7 BrowserRouter in declarative mode. Route tree with a layout route wrapping all pages. `/` redirects to `/datasets`. Routes: `/datasets/*`, `/tts`, `/realtime`, `/providers`. Export an `AppRoutes` component containing `<BrowserRouter>`.

2. **`AppLayout.tsx`** -- Horizontal flex container: Sidebar (fixed left, `w-60`) + main area (vertical flex: Header on top, content with `<Outlet />` below).

3. **`Sidebar.tsx`** -- Fixed left sidebar, `w-60`, dark background (`bg-gray-900`). NavLink items: Datasets, TTS Testing, Realtime, Providers. Active state styling via `className` callback + `clsx`. App title "Sound Lab" at top.

4. **`Header.tsx`** -- Top bar showing "Local Mode" text, spans the content area right of sidebar.

5. **`App.tsx`** -- Full rewrite. Module-level `QueryClient`, `QueryClientProvider` wrapping `<AppRoutes />`. Default export `App` function.

6. **`index.css`** -- Keep `@import "tailwindcss"`, add `html, body, #root { height: 100% }`.

Additionally:
- 4 placeholder pages in `frontend/src/pages/`: `DatasetsPage`, `TtsPage`, `RealtimePage`, `ProvidersPage` -- each with heading + description paragraph.
- Directories to create: `components/layout/`, `pages/`.
- Import from `"react-router"` (not `"react-router-dom"`).
- Use `.tsx` extensions in relative imports.
- No `useMemo`/`useCallback`/`React.memo` (React Compiler active).
- Use `import type` for type-only imports (`verbatimModuleSyntax`).
- `main.tsx` stays unchanged.

Key architectural decisions:
- Declarative BrowserRouter mode (not `createBrowserRouter` data mode)
- `BrowserRouter` inside `AppRoutes` in `router.tsx`, not in `App.tsx`
- `QueryClientProvider` wraps the router at app root
- Placeholder pages in flat `pages/` dir (not feature dirs)
- NavLink active state: `className` callback with `clsx`
- Sidebar styling: `w-60 shrink-0 flex-col bg-gray-900`, nav items with `transition-colors`

## What Was Implemented

### Files created (8 new files):
- `frontend/src/components/layout/AppLayout.tsx` -- Flex container (`flex h-full`), composes `<Sidebar />` + vertical flex div with `<Header />` and `<main>` containing `<Outlet />`. Main area has `flex-1 overflow-auto bg-gray-50 p-6`.
- `frontend/src/components/layout/Header.tsx` -- `<header>` with `flex h-12 items-center border-b border-gray-200 bg-white px-6`, contains `<span>` with "Local Mode".
- `frontend/src/components/layout/Sidebar.tsx` -- `<aside>` with `flex w-60 shrink-0 flex-col bg-gray-900`. Title area with "Sound Lab". `navItems` array mapped to `NavLink` elements with `className` callback using `clsx`. Active: `bg-gray-800 text-white`. Inactive: `text-gray-400 hover:bg-gray-800/50 hover:text-white`. All with `transition-colors`.
- `frontend/src/pages/DatasetsPage.tsx` -- Heading "Datasets" + description.
- `frontend/src/pages/TtsPage.tsx` -- Heading "TTS Testing" + description.
- `frontend/src/pages/RealtimePage.tsx` -- Heading "Realtime" + description.
- `frontend/src/pages/ProvidersPage.tsx` -- Heading "Providers" + description.
- `frontend/src/router.tsx` -- Exports `AppRoutes` function containing `<BrowserRouter>` > `<Routes>` > layout `<Route element={<AppLayout />}>` wrapping index redirect and 4 page routes.

### Files modified (2 files):
- `frontend/src/App.tsx` -- Full rewrite. Module-level `new QueryClient()`. Default export `App` wrapping `<QueryClientProvider>` > `<AppRoutes />`.
- `frontend/src/index.css` -- `@import "tailwindcss"` + `html, body, #root { height: 100% }`.

### Files NOT modified (as expected):
- `frontend/src/main.tsx` -- Unchanged, still renders `<App />` in `<StrictMode>`.

## Mismatches

After comparing every point in the analysis against the actual implementation, **no mismatches were found**. Specifically verified:

| Analysis Requirement | Implementation | Match |
|---|---|---|
| Declarative BrowserRouter mode | `BrowserRouter` + `Routes` JSX in `router.tsx` | Exact |
| Import from `"react-router"` | All imports use `"react-router"` | Exact |
| `.tsx` extensions in relative imports | All relative imports use `.tsx` | Exact |
| Layout route pattern (`Route element={<AppLayout />}`) | Present in `router.tsx` line 12 | Exact |
| Index redirect to `/datasets` | `<Navigate to="/datasets" replace />` on index route | Exact |
| Route paths: `datasets/*`, `tts`, `realtime`, `providers` | All 4 present with correct paths | Exact |
| Sidebar: `w-60`, `bg-gray-900`, dark theme | `flex w-60 shrink-0 flex-col bg-gray-900` | Exact |
| Sidebar NavLink with `clsx` + `className` callback | Implemented with active/inactive states as specified | Exact |
| Sidebar nav items: Datasets, TTS Testing, Realtime, Providers | All 4 items in `navItems` array | Exact |
| Sidebar title: "Sound Lab" | Present in `h-12` title area | Exact |
| Header: "Local Mode" text | `<span>` with `text-sm text-gray-500` | Exact |
| AppLayout: flex container with Sidebar + Header + Outlet | `flex h-full` with nested flex structure | Exact |
| App.tsx: module-level `QueryClient`, `QueryClientProvider` wrapping `AppRoutes` | Exact match to plan code | Exact |
| index.css: Tailwind import + height reset | Exact match to plan | Exact |
| Placeholder pages: heading + description | All 4 pages match plan exactly | Exact |
| No `useMemo`/`useCallback`/`React.memo` | None used | Exact |
| No barrel files | No `index.ts` files created | Exact |
| Pages in flat `pages/` directory | All in `frontend/src/pages/` | Exact |

## Corrections Made

No corrections were needed during implementation. The analysis was thorough enough that the implementation followed it verbatim. The code in every file matches the plan's code blocks character-for-character.

One notable observation: the analysis noted that `App.css` might not exist ("No `App.css` to delete -- already absent in the worktree"), and the execution log confirmed this. The `App.css` deletion visible in `git diff main` is from issue #19, not this task. The implementation correctly did not attempt to delete it.

## Final Alignment Verdict

**ALIGNED**

The implementation is a precise, point-by-point match to the analysis. All 6 deliverables were built exactly as specified. All 9 architectural decisions were followed. All constraints (tsconfig, React Compiler, import conventions, Tailwind v4) were respected. The file structure, code patterns, class names, component composition, and routing configuration all match the analysis and plan documents exactly.
