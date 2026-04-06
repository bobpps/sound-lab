# Code Review: feat/21-app-shell

Branch: `feat/21-app-shell` (1 commit: `72f4fcf`)
Diff against: `origin/main`
Changed files: 11 (10 frontend source + 1 execution log)

---

## Frontend Patterns

### [FE-1] Pages placed in flat `pages/` directory instead of feature-based structure -- Minor
**File:** `frontend/src/pages/DatasetsPage.tsx`, `ProvidersPage.tsx`, `RealtimePage.tsx`, `TtsPage.tsx`
**What's wrong:** `frontend/CLAUDE.md` explicitly mandates feature-based structure: `features/datasets/`, `features/tts/`, etc. These placeholder pages are dumped into a flat `pages/` directory instead.
**Why it's bad:** Sets the wrong precedent. When someone adds real components, hooks, and API queries for datasets, they will either (a) scatter them into `pages/` creating a mess, or (b) have to refactor these pages into `features/` later -- work that could have been done from the start. The execution log even acknowledges these are "throwaway" pages placed in `pages/` (flat), but "throwaway" code has a habit of becoming permanent.

### [FE-2] Inconsistent wildcard routing across pages -- Minor
**File:** `frontend/src/router.tsx:14`
**What's wrong:** `datasets/*` gets a wildcard splat, but `tts`, `realtime`, and `providers` do not. There is no stated reason why datasets needs nested routing but the others do not.
**Why it's bad:** Inconsistency without explanation. If future nested routes are planned for datasets, fine -- but there is no comment, no ticket reference, nothing. If someone adds nested routes to `providers` later, they will have to first notice that datasets already has the wildcard and wonder why providers does not. Either all placeholder routes should have the splat or none should.

## Potential Bugs

### [BUG-1] No catch-all / 404 route -- Minor
**File:** `frontend/src/router.tsx`
**What's wrong:** There is no `<Route path="*" element={...} />` to handle unknown URLs. Any typo in the URL (e.g., `/dataset` instead of `/datasets`) renders a blank content area with no feedback.
**Why it's bad:** Silent failure. The user sees the sidebar and header but the content area is empty with zero indication of what went wrong. A trivial `<Route path="*" element={<Navigate to="/datasets" replace />} />` or a "not found" page would prevent confusion.

### [BUG-2] Orphaned Vite starter assets -- Minor
**File:** `frontend/src/assets/hero.png`, `react.svg`, `vite.svg`
**What's wrong:** The old `App.tsx` that consumed these assets was completely rewritten. Nothing imports these files anymore.
**Why it's bad:** Dead weight in the repository. 170x179 hero.png, two SVGs -- not huge, but they signal to future contributors that they are used somewhere, inviting cargo-cult imports.

## Code Quality

### [QUAL-1] Module-level `QueryClient` instantiation -- Minor
**File:** `frontend/src/App.tsx:3`
**What's wrong:** `const queryClient = new QueryClient()` is created at module scope. In SSR or test contexts, module-scope singletons are shared across renders/tests, causing cache leakage. The standard pattern is to create it inside the component (with a `useState` or `useRef` to stabilize it) or in a factory.
**Why it's bad:** For this project (client-only SPA, no SSR), it works. But if tests ever import `App` directly, the query cache persists between test runs. The `frontend/CLAUDE.md` mentions a `renderWithProviders` helper for tests, suggesting they are expected to create their own `QueryClient` -- so this is survivable but still not best practice. The TanStack Query docs explicitly warn against this pattern.

### [QUAL-2] Four identical placeholder page components -- Minor
**File:** `frontend/src/pages/DatasetsPage.tsx`, `ProvidersPage.tsx`, `RealtimePage.tsx`, `TtsPage.tsx`
**What's wrong:** All four pages follow the exact same template: `<div><h1>Title</h1><p>Description</p></div>`. The only difference is the text content.
**Why it's bad:** Mild copy-paste. A single `PlaceholderPage` component parameterized by title and description would eliminate the duplication. That said, these are truly throwaway and will be replaced soon, so the cost of the abstraction may exceed the cost of the duplication. Barely worth mentioning, but it is technically four files doing the same thing.

## Testing Violations

### [TEST-1] No tests for new code -- Major
**File:** (no test files added)
**What's wrong:** The branch adds a router, three layout components, and four pages. Zero test files. The root `CLAUDE.md` states "TDD by default", and `frontend/CLAUDE.md` specifies Vitest + React Testing Library + MSW. The execution log lists Playwright verification but no unit/integration tests.
**Why it's bad:** The router is the backbone of the app. A simple test that verifies "navigating to `/datasets` renders DatasetsPage" and "the sidebar highlights the active link" would catch regressions when routes are added or refactored. Without tests, any future change to the router or layout is a blind refactor.

---

## Summary

| Severity | Count |
|---|---|
| Fundamental | 0 |
| Major | 1 |
| Minor | 6 |

**Overall assessment:** Clean, minimal shell implementation that follows most project conventions (no barrel files, correct imports from `"react-router"`, Tailwind-only styling, proper `.tsx` extensions, `clsx` for conditional classes). The single major issue is the complete absence of tests for a TDD-mandated project. The minor issues -- flat `pages/` instead of `features/`, inconsistent wildcard routing, missing 404, orphaned assets, module-scope QueryClient, and copy-paste placeholders -- are all low-consequence but worth flagging before this pattern propagates.
