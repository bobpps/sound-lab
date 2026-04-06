# App Shell (Routing, Layout, Sidebar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the app shell -- sidebar navigation, header, layout container, route configuration, and placeholder pages -- so the frontend has a working navigation structure for all features.

**Architecture:** Single layout route (`AppLayout`) wrapping all pages via React Router v7's `<Outlet />`. The layout is a horizontal flex: fixed-width dark sidebar on the left, main content area on the right with a header bar on top. `QueryClientProvider` wraps the entire router at the app root. Placeholder pages will be replaced by real feature pages in future issues.

**Tech Stack:** React 19, React Router 7.14 (declarative BrowserRouter mode), TanStack Query 5, Tailwind CSS 4, clsx, TypeScript 5.9

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/index.css` | Tailwind import + full-height base styles |
| Create | `frontend/src/components/layout/Header.tsx` | Top bar showing "Local Mode" |
| Create | `frontend/src/components/layout/Sidebar.tsx` | Dark nav sidebar with NavLink items |
| Create | `frontend/src/components/layout/AppLayout.tsx` | Flex container composing Sidebar + Header + Outlet |
| Create | `frontend/src/pages/DatasetsPage.tsx` | Placeholder |
| Create | `frontend/src/pages/TtsPage.tsx` | Placeholder |
| Create | `frontend/src/pages/RealtimePage.tsx` | Placeholder |
| Create | `frontend/src/pages/ProvidersPage.tsx` | Placeholder |
| Create | `frontend/src/router.tsx` | BrowserRouter + Routes tree with layout route |
| Modify | `frontend/src/App.tsx` | Full rewrite: QueryClientProvider + AppRoutes |

### Directories to create

- `frontend/src/components/layout/`
- `frontend/src/pages/`

---

## Important Context for the Implementer

**tsconfig constraints** (from `frontend/tsconfig.app.json`):
- `verbatimModuleSyntax: true` -- you MUST use `import type { ... }` for type-only imports
- `noUnusedLocals: true`, `noUnusedParameters: true` -- no unused variables/imports
- `allowImportingTsExtensions: true` -- use `.tsx` extensions in relative imports
- `erasableSyntaxOnly: true` -- no enums, no parameter properties

**Import convention:** Import from `"react-router"` (not `"react-router-dom"`) -- this is the canonical import path in React Router v7. The `react-router-dom` package is installed (it depends on `react-router`), but `react-router` is the base package that exports everything.

**React Compiler is active** -- do NOT use `useMemo`, `useCallback`, or `React.memo`.

**Existing files:** `main.tsx` renders `<App />` inside `<StrictMode>` and imports `./index.css`. Do not modify `main.tsx`.

**Verification commands** (run from worktree root):
- Type-check: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
- Lint: `npm run lint --workspace=frontend`
- Build: `npm run build --workspace=frontend`

---

### Task 1: Clean up index.css and set base layout styles

**Files:**
- Modify: `frontend/src/index.css`

The current file contains only `@import "tailwindcss";` (it's already clean). We need to add full-height base styles so the flex layout fills the viewport.

- [ ] **Step 1: Add full-height base styles to index.css**

Replace the entire contents of `frontend/src/index.css` with:

```css
@import "tailwindcss";

html,
body,
#root {
  height: 100%;
}
```

- [ ] **Step 2: Verify the change**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors (CSS is not type-checked, but ensures nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): add full-height base styles for app shell layout"
```

---

### Task 2: Create Header component

**Files:**
- Create: `frontend/src/components/layout/Header.tsx`

The simplest component -- a top bar spanning the content area, showing "Local Mode" text.

- [ ] **Step 1: Create the layout directory**

```bash
mkdir -p frontend/src/components/layout
```

- [ ] **Step 2: Create Header.tsx**

Create `frontend/src/components/layout/Header.tsx`:

```tsx
export function Header() {
  return (
    <header className="flex h-12 items-center border-b border-gray-200 bg-white px-6">
      <span className="text-sm text-gray-500">Local Mode</span>
    </header>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "feat(frontend): add Header component with Local Mode indicator"
```

---

### Task 3: Create Sidebar component

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`

Dark sidebar with app title and NavLink items. Uses `clsx` for conditional class joining on active state.

- [ ] **Step 1: Create Sidebar.tsx**

Create `frontend/src/components/layout/Sidebar.tsx`:

```tsx
import { NavLink } from "react-router";
import clsx from "clsx";

const navItems = [
  { to: "/datasets", label: "Datasets" },
  { to: "/tts", label: "TTS Testing" },
  { to: "/realtime", label: "Realtime" },
  { to: "/providers", label: "Providers" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gray-900">
      <div className="flex h-12 items-center px-4">
        <span className="text-lg font-semibold text-white">Sound Lab</span>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                "block rounded px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/50 hover:text-white",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

Run: `npm run lint --workspace=frontend`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(frontend): add Sidebar component with NavLink navigation"
```

---

### Task 4: Create AppLayout component

**Files:**
- Create: `frontend/src/components/layout/AppLayout.tsx`

Flex layout composing Sidebar + Header + Outlet.

- [ ] **Step 1: Create AppLayout.tsx**

Create `frontend/src/components/layout/AppLayout.tsx`:

```tsx
import { Outlet } from "react-router";
import { Header } from "./Header.tsx";
import { Sidebar } from "./Sidebar.tsx";

export function AppLayout() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx
git commit -m "feat(frontend): add AppLayout with sidebar, header, and content area"
```

---

### Task 5: Create placeholder pages

**Files:**
- Create: `frontend/src/pages/DatasetsPage.tsx`
- Create: `frontend/src/pages/TtsPage.tsx`
- Create: `frontend/src/pages/RealtimePage.tsx`
- Create: `frontend/src/pages/ProvidersPage.tsx`

All four pages follow the same pattern: heading + short description.

- [ ] **Step 1: Create the pages directory**

```bash
mkdir -p frontend/src/pages
```

- [ ] **Step 2: Create DatasetsPage.tsx**

Create `frontend/src/pages/DatasetsPage.tsx`:

```tsx
export function DatasetsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Datasets</h1>
      <p className="mt-2 text-gray-600">Manage dialog datasets for TTS testing.</p>
    </div>
  );
}
```

- [ ] **Step 3: Create TtsPage.tsx**

Create `frontend/src/pages/TtsPage.tsx`:

```tsx
export function TtsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">TTS Testing</h1>
      <p className="mt-2 text-gray-600">Test text-to-speech providers and compare outputs.</p>
    </div>
  );
}
```

- [ ] **Step 4: Create RealtimePage.tsx**

Create `frontend/src/pages/RealtimePage.tsx`:

```tsx
export function RealtimePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Realtime</h1>
      <p className="mt-2 text-gray-600">Configure and test realtime voice agents.</p>
    </div>
  );
}
```

- [ ] **Step 5: Create ProvidersPage.tsx**

Create `frontend/src/pages/ProvidersPage.tsx`:

```tsx
export function ProvidersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
      <p className="mt-2 text-gray-600">Manage TTS provider configurations and API keys.</p>
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/DatasetsPage.tsx frontend/src/pages/TtsPage.tsx frontend/src/pages/RealtimePage.tsx frontend/src/pages/ProvidersPage.tsx
git commit -m "feat(frontend): add placeholder pages for Datasets, TTS, Realtime, Providers"
```

---

### Task 6: Create router configuration

**Files:**
- Create: `frontend/src/router.tsx`

BrowserRouter + Routes tree. Layout route wraps all pages. Root `/` redirects to `/datasets`.

- [ ] **Step 1: Create router.tsx**

Create `frontend/src/router.tsx`:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppLayout } from "./components/layout/AppLayout.tsx";
import { DatasetsPage } from "./pages/DatasetsPage.tsx";
import { TtsPage } from "./pages/TtsPage.tsx";
import { RealtimePage } from "./pages/RealtimePage.tsx";
import { ProvidersPage } from "./pages/ProvidersPage.tsx";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/datasets" replace />} />
          <Route path="datasets/*" element={<DatasetsPage />} />
          <Route path="tts" element={<TtsPage />} />
          <Route path="realtime" element={<RealtimePage />} />
          <Route path="providers" element={<ProvidersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/router.tsx
git commit -m "feat(frontend): add router config with BrowserRouter and layout route"
```

---

### Task 7: Rewrite App.tsx with providers

**Files:**
- Modify: `frontend/src/App.tsx` (full rewrite -- replace entire contents)

Module-level QueryClient, QueryClientProvider wrapping AppRoutes.

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire contents of `frontend/src/App.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./router.tsx";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc -b --noEmit -p frontend/tsconfig.app.json`
Expected: No errors.

- [ ] **Step 3: Verify lint**

Run: `npm run lint --workspace=frontend`
Expected: No errors.

- [ ] **Step 4: Verify build**

Run: `npm run build --workspace=frontend`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): rewrite App.tsx with QueryClientProvider and router"
```

---

### Task 8: Visual verification with Playwright

**Files:** None (verification only)

Start the dev server and verify the app shell renders correctly using Playwright.

- [ ] **Step 1: Start the frontend dev server**

```bash
cd frontend && npx vite --port 5173 &
```

Wait a few seconds for the server to start.

- [ ] **Step 2: Open the app in Playwright and take a screenshot**

Use the Playwright MCP tools:
1. `browser_navigate` to `http://localhost:5173`
2. `browser_take_screenshot` -- verify:
   - Dark sidebar on the left (w-60, bg-gray-900) with "Sound Lab" title and four nav links
   - "Datasets" nav link is highlighted (active state) since `/` redirects to `/datasets`
   - Header bar on top-right with "Local Mode" text
   - Main content area showing "Datasets" heading and description
   - Full-height layout, no scrollbar artifacts
3. `browser_console_messages` -- verify no errors or warnings

- [ ] **Step 3: Test navigation**

Use Playwright to click each nav link and verify:
1. Click "TTS Testing" -- URL changes to `/tts`, content shows "TTS Testing" heading, sidebar highlights "TTS Testing"
2. Click "Realtime" -- URL changes to `/realtime`, content shows "Realtime" heading
3. Click "Providers" -- URL changes to `/providers`, content shows "Providers" heading
4. Click "Datasets" -- URL changes to `/datasets`, back to "Datasets" heading

- [ ] **Step 4: Stop the dev server**

Kill the background vite process.

- [ ] **Step 5: Final commit (if any fixes were needed)**

If Playwright verification revealed issues that required code fixes, commit those fixes:

```bash
git add -u
git commit -m "fix(frontend): address visual issues found during Playwright verification"
```

If no fixes were needed, skip this step.
