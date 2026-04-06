# Analysis -- Issue #21: App Shell (Routing, Layout, Sidebar)

## What the Task Requires

### Deliverables (6 items)

1. **`frontend/src/router.tsx`** -- React Router v7 BrowserRouter config
   - Route tree with layout route wrapping all pages
   - `/` redirects to `/datasets`
   - Routes: `/datasets/*`, `/tts`, `/realtime`, `/providers`
   - Placeholder page components for each route

2. **`frontend/src/components/layout/AppLayout.tsx`** -- flex layout container
   - Horizontal flex: Sidebar (fixed left) + main area
   - Main area: vertical flex with Header on top, content below
   - Content area renders `<Outlet />` for child routes

3. **`frontend/src/components/layout/Sidebar.tsx`** -- navigation sidebar
   - Fixed left sidebar, `w-60`, dark background
   - NavLink items: Datasets, TTS Testing, Realtime, Providers
   - Active state styling (highlighted item)
   - App title/logo area at top

4. **`frontend/src/components/layout/Header.tsx`** -- top header bar
   - Shows "Local Mode" text
   - Spans the content area (right of sidebar)

5. **`frontend/src/App.tsx`** -- full rewrite
   - Remove Vite boilerplate entirely
   - Wrap with `QueryClientProvider` (TanStack Query)
   - Render `BrowserRouter`/`Routes` or `RouterProvider`
   - StrictMode stays in `main.tsx`

6. **`frontend/src/index.css`** -- replace Vite boilerplate CSS
   - Keep `@import "tailwindcss"`
   - Remove all Vite boilerplate custom properties and styles
   - Add minimal base styles for full-height layout

### Cleanup

- **No `App.css` to delete** -- already absent in the worktree
- **Remove boilerplate from `index.css`** -- the current CSS has extensive Vite starter styles (`:root` custom properties, heading styles, code styles, etc.) that conflict with Tailwind's reset and our layout
- **Vite assets** (`hero.png`, `react.svg`, `vite.svg`) -- can remain in `assets/` for now; unused imports will be removed from App.tsx

## Constraints from Project Guidance

### From `frontend/CLAUDE.md`

| Constraint | Impact on This Task |
|---|---|
| Feature-based structure | Placeholder pages go in `features/datasets/`, `features/tts/`, etc. -- OR simpler: inline placeholder components in `router.tsx` since they are temporary |
| No barrel files | Each component in its own file, import directly |
| No cross-feature imports | Layout components are shared (`components/layout/`), not feature-specific |
| React Compiler active | No `useMemo`/`useCallback`/`React.memo` |
| `forwardRef` deprecated | Use `ref` as regular prop (not relevant here) |
| React Router v7 | Layout routes with `<Outlet />` |
| Tailwind CSS | Utility classes, no runtime CSS-in-JS |
| TanStack Query | `QueryClientProvider` wrapping the app |
| `verbatimModuleSyntax` | Must use `import type` for type-only imports |
| `erasableSyntaxOnly` | No enums, no parameter properties |

### From root `CLAUDE.md`

- ESM everywhere, `.ts` extensions in imports (though Vite resolves both)
- TDD by default -- but layout components are presentational; type-check + Playwright verification is more appropriate
- Verify UI with Playwright

### From `tsconfig.app.json`

- `allowImportingTsExtensions: true` -- use `.ts`/`.tsx` extensions in imports
- `noUnusedLocals: true`, `noUnusedParameters: true` -- strict unused checking

## Key Files to Create/Modify

### Create

| File | Purpose |
|---|---|
| `frontend/src/router.tsx` | Route configuration |
| `frontend/src/components/layout/AppLayout.tsx` | Main layout wrapper |
| `frontend/src/components/layout/Sidebar.tsx` | Navigation sidebar |
| `frontend/src/components/layout/Header.tsx` | Top header bar |
| `frontend/src/pages/DatasetsPage.tsx` | Placeholder page |
| `frontend/src/pages/TtsPage.tsx` | Placeholder page |
| `frontend/src/pages/RealtimePage.tsx` | Placeholder page |
| `frontend/src/pages/ProvidersPage.tsx` | Placeholder page |

### Modify

| File | Changes |
|---|---|
| `frontend/src/App.tsx` | Full rewrite: QueryClientProvider + BrowserRouter + Routes |
| `frontend/src/index.css` | Strip Vite boilerplate CSS, keep `@import "tailwindcss"`, add base layout styles |

### Directories to Create

- `frontend/src/components/layout/`
- `frontend/src/pages/`

## Architectural Decisions

### 1. React Router v7: Declarative Mode (BrowserRouter) vs Data Mode (createBrowserRouter)

**Decision: Use declarative BrowserRouter mode.**

Rationale:
- The issue says "BrowserRouter config" explicitly
- We don't need loaders/actions yet (placeholder pages have no data fetching)
- Simpler setup -- BrowserRouter + Routes JSX in App.tsx
- Data fetching will use TanStack Query (per frontend/CLAUDE.md), not React Router loaders
- Can always migrate to data mode later if needed

Pattern from React Router v7 docs:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

// Note: import from "react-router" (not "react-router-dom") in v7
```

### 2. Route Configuration Location

**Decision: Define routes inline in `router.tsx`, export a `<AppRoutes />` component.**

The issue asks for `router.tsx` as a separate file. We export a component that contains `<BrowserRouter>` + `<Routes>` tree. `App.tsx` wraps it with providers.

Alternative considered: export route config array + `createBrowserRouter`. Rejected because the issue specifically mentions BrowserRouter and the declarative pattern is simpler for this use case.

### 3. Placeholder Pages Location

**Decision: Create minimal page components in `frontend/src/pages/`.**

Options considered:
- (a) Inline in `router.tsx` as arrow functions -- violates component-per-file norms
- (b) Feature dirs (`features/datasets/pages/`) -- premature; these are throwaway placeholders
- (c) `pages/` directory -- simple, clear, will be replaced when features are built

Going with (c). Each placeholder is a simple component showing the page name. When features are implemented (future issues), these will be replaced with real feature pages.

### 4. Layout Approach

**Decision: Single layout route wrapping all pages.**

```
<Route element={<AppLayout />}>
  <Route index element={<Navigate to="/datasets" replace />} />
  <Route path="datasets/*" element={<DatasetsPage />} />
  <Route path="tts" element={<TtsPage />} />
  <Route path="realtime" element={<RealtimePage />} />
  <Route path="providers" element={<ProvidersPage />} />
</Route>
```

`AppLayout` renders `<Sidebar />` + `<Header />` + `<Outlet />` in a flex container. This follows the layout route pattern from React Router v7 docs exactly.

### 5. Sidebar Styling (Tailwind v4)

**Decision: Dark sidebar using Tailwind v4 utility classes directly.**

Tailwind v4 uses `@import "tailwindcss"` (already configured) and all utilities work out of the box without a config file. Key classes:
- Sidebar container: `w-60 min-h-screen bg-gray-900 text-gray-300 flex flex-col`
- NavLink active: `bg-gray-800 text-white` (or similar highlight)
- NavLink default: `text-gray-400 hover:text-white hover:bg-gray-800`
- Transition: `transition-colors`

No need for a `tailwind.config.js` -- Tailwind v4 auto-detects content files and provides all utilities by default.

### 6. App.tsx Provider Wrapping Order

**Decision:**
```tsx
<QueryClientProvider client={queryClient}>
  <AppRoutes />     {/* contains BrowserRouter */}
</QueryClientProvider>
```

`QueryClientProvider` wraps the router so that all route components can use `useQuery`/`useMutation`. The `QueryClient` instance is created at module level in `App.tsx` (no need for `useMemo` due to React Compiler).

Note: `BrowserRouter` is inside `<AppRoutes />` (in `router.tsx`), not in `App.tsx`. This keeps routing config isolated.

### 7. NavLink Active State

**Decision: Use NavLink's `className` callback with Tailwind classes.**

```tsx
<NavLink
  to="/datasets"
  className={({ isActive }) =>
    `block px-4 py-2 rounded ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`
  }
>
  Datasets
</NavLink>
```

This follows the React Router v7 pattern directly. Using `clsx` (already in deps) for cleaner conditional class joining.

### 8. index.css Cleanup

**Decision: Strip all Vite boilerplate, keep only Tailwind import + minimal resets.**

The current `index.css` has ~200 lines of Vite starter CSS including custom properties, heading styles, code styles, etc. All of this must be removed because:
- Tailwind's preflight (reset) handles base styles
- Custom properties conflict with Tailwind's design system
- The Vite boilerplate styles are for the starter template, not our app

New `index.css`:
```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
}
```

### 9. import from "react-router" vs "react-router-dom"

**Decision: Import from `"react-router"`.**

In React Router v7, `react-router-dom` re-exports everything from `react-router`. The `react-router` package is the canonical import source. However, `BrowserRouter` specifically is exported from `react-router` in v7 (it was previously DOM-only). We'll use `react-router` for all imports.

Note: the installed package is `react-router-dom@7.14.0`, which depends on `react-router@7.14.0`. Both are available for import.

## Risks and Assumptions

### Risks

1. **Tailwind v4 reset vs custom CSS** -- If any leftover CSS in `index.css` conflicts with Tailwind's preflight, the layout may render incorrectly. Mitigation: strip ALL boilerplate CSS from `index.css`.

2. **React Router v7 import paths** -- v7 changed the import structure from v6. `BrowserRouter` in v7 is exported from `react-router` (the base package). If importing from `react-router-dom`, it should also work as a re-export. Need to verify which import path the installed version supports.

3. **Sidebar height** -- `min-h-screen` on sidebar may not work if parent doesn't have height set. Need to ensure `html`, `body`, `#root` all have `height: 100%`.

### Assumptions

1. Placeholder pages are intentionally minimal (heading + paragraph) -- real feature pages come in later issues
2. No authentication/guards needed yet -- "Local Mode" is just a text indicator
3. `datasets/*` uses wildcard for future nested routes within datasets feature
4. The Vite boilerplate assets (`hero.png`, `react.svg`, `vite.svg`) can remain in the repo (cleanup is a separate concern)
5. `main.tsx` stays unchanged -- it already renders `<App />` in `<StrictMode>`

## Unknowns Resolved

| Unknown | Resolution |
|---|---|
| Is there an `App.css` to delete? | No -- absent in the worktree. The main repo's `index.css` has all boilerplate styles, which we'll replace. |
| React Router v7 API for BrowserRouter? | Confirmed: `import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from "react-router"`. Declarative mode with JSX routes. |
| Tailwind v4 configuration needed? | No -- `@import "tailwindcss"` in CSS + `@tailwindcss/vite` plugin is sufficient. No config file needed. |
| QueryClient instantiation pattern? | Module-level `new QueryClient()` in `App.tsx`. No `useMemo` needed (React Compiler handles it; also it's module-level, not in render). |
| Layout route pattern in RR v7? | Route without `path` or with `path` wrapping children, using `<Outlet />`. Confirmed from docs. |
| NavLink active state API? | `className={({ isActive }) => ...}` callback. Confirmed from docs. |
| Where do placeholder pages go? | `frontend/src/pages/` -- simple flat structure for throwaway placeholders. |

## Implementation Order

1. Clean up `index.css` (remove boilerplate, keep Tailwind import + base height)
2. Create `Header.tsx` (simplest component, no deps)
3. Create `Sidebar.tsx` (NavLink items, active styling)
4. Create `AppLayout.tsx` (composes Header + Sidebar + Outlet)
5. Create placeholder pages (4 simple components)
6. Create `router.tsx` (route tree with layout route + redirects)
7. Rewrite `App.tsx` (QueryClientProvider + AppRoutes)
8. Verify: `tsc --noEmit`, `eslint`, then Playwright
