# Frontend Dependencies + Tailwind + Vite Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install all frontend dependencies, configure Tailwind CSS v4, set up Vite dev proxy to backend, and clean up boilerplate CSS files.

**Architecture:** This is pure configuration — no business logic. We add runtime deps (routing, state, forms, utils) and dev deps (Tailwind), then wire Tailwind into Vite and replace the boilerplate CSS with Tailwind's import directive. The Vite proxy maps `/api/*` to `http://localhost:3000/*` (stripping the `/api` prefix since backend routes have no prefix).

**Tech Stack:** Vite 8, Tailwind CSS v4 (`@tailwindcss/vite` plugin), React Router v7, TanStack Query, Zustand, React Hook Form + Zod, clsx.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `frontend/package.json` | Add 7 runtime + 2 dev dependencies |
| Modify | `frontend/vite.config.ts` | Add Tailwind plugin + `/api` proxy |
| Rewrite | `frontend/src/index.css` | Replace boilerplate with `@import "tailwindcss"` |
| Modify | `frontend/src/App.tsx` | Remove `import './App.css'` line |
| Delete | `frontend/src/App.css` | No longer needed — Tailwind replaces it |

---

### Task 1: Install all dependencies

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] **Step 1: Install runtime dependencies**

Run from the **repository root** (npm workspaces):

```bash
npm install --workspace=frontend react-router-dom @tanstack/react-query zustand react-hook-form @hookform/resolvers zod clsx
```

This adds to `frontend/package.json` `dependencies`:
- `react-router-dom` — routing
- `@tanstack/react-query` — server state
- `zustand` — client state
- `react-hook-form` — form management
- `@hookform/resolvers` — zod resolver for react-hook-form
- `zod` — schema validation
- `clsx` — conditional className utility

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --workspace=frontend -D tailwindcss @tailwindcss/vite
```

This adds to `frontend/package.json` `devDependencies`:
- `tailwindcss` — Tailwind CSS v4 engine
- `@tailwindcss/vite` — Vite plugin (replaces PostCSS-based setup)

- [ ] **Step 3: Verify package.json has all deps**

```bash
node -e "const p = require('./frontend/package.json'); const deps = Object.keys(p.dependencies); const devDeps = Object.keys(p.devDependencies); console.log('deps:', deps.join(', ')); console.log('devDeps:', devDeps.join(', '));"
```

Expected output should include all 9 new packages (7 runtime + 2 dev) alongside the existing `react`, `react-dom`, and dev deps.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json package-lock.json
git commit -m "feat(frontend): install runtime and dev dependencies

Add react-router-dom, @tanstack/react-query, zustand, react-hook-form,
@hookform/resolvers, zod, clsx as runtime deps.
Add tailwindcss and @tailwindcss/vite as dev deps."
```

---

### Task 2: Configure Vite (Tailwind plugin + API proxy)

**Files:**
- Modify: `frontend/vite.config.ts`

**Context:** The current `vite.config.ts` content is:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

`tsconfig.node.json` has `verbatimModuleSyntax: true`, so the `@tailwindcss/vite` import must use a type-compatible form. Since `@tailwindcss/vite` exports a default function, a standard default import works fine.

Backend routes have **no** `/api` prefix (e.g., `/providers`, `/dialogs`). The frontend will call `/api/providers`, and the proxy must strip `/api` before forwarding.

- [ ] **Step 1: Rewrite vite.config.ts**

Replace the entire content of `frontend/vite.config.ts` with:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd frontend && npx tsc -p tsconfig.node.json --noEmit
```

Expected: no errors. If `@tailwindcss/vite` types are missing, the import will fail here — that would indicate a version mismatch (unlikely with v4).

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat(frontend): configure Tailwind v4 Vite plugin and API proxy

Add @tailwindcss/vite plugin alongside react plugin.
Proxy /api/* to http://localhost:3000/* with prefix stripping."
```

---

### Task 3: Replace index.css with Tailwind directives and clean up App.css

**Files:**
- Rewrite: `frontend/src/index.css`
- Modify: `frontend/src/App.tsx` (line 5: remove `import './App.css'`)
- Delete: `frontend/src/App.css`

**Context:** Tailwind CSS v4 uses a single `@import "tailwindcss"` directive — no `@tailwind base/components/utilities` layers, no `tailwind.config.js`. The import in `main.tsx` (`import './index.css'`) stays unchanged.

`App.css` contains boilerplate component styles for the Vite starter template. These will be replaced by Tailwind utility classes in future tasks. Removing the import now prevents a missing-file error after deletion.

- [ ] **Step 1: Replace index.css content**

Replace the entire content of `frontend/src/index.css` with:

```css
@import "tailwindcss";
```

That single line is all Tailwind v4 needs. Custom theme extensions, if needed later, go below this import using `@theme` blocks.

- [ ] **Step 2: Remove App.css import from App.tsx**

In `frontend/src/App.tsx`, remove line 5:

```typescript
import './App.css'
```

The file should then read (first 5 lines):

```typescript
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'

function App() {
```

- [ ] **Step 3: Delete App.css**

```bash
rm frontend/src/App.css
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd frontend && npx vite --host 127.0.0.1 &
VITE_PID=$!
sleep 5
curl -s http://127.0.0.1:5173/ | head -20
kill $VITE_PID 2>/dev/null
```

Expected: HTML output with no errors. The dev server should start without build failures.

Alternatively (faster, no server needed):

```bash
cd frontend && npx vite build 2>&1 | tail -5
```

Expected: `vite build` completes successfully, outputting bundle size info with no errors.

- [ ] **Step 5: Verify Tailwind is processing**

After `vite build`, check that the output CSS contains Tailwind's reset/base styles:

```bash
grep -l "tailwindcss" frontend/dist/assets/*.css 2>/dev/null || echo "Check: Tailwind CSS not found in build output"
```

If found, Tailwind is correctly integrated. (The build output CSS will contain Tailwind's preflight/base styles even if no utility classes are used yet.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/App.tsx
git rm frontend/src/App.css
git commit -m "feat(frontend): replace boilerplate CSS with Tailwind v4

Replace index.css with @import 'tailwindcss' directive.
Remove App.css and its import — component styles will use Tailwind utilities."
```

---

## Verification Summary

After all 3 tasks, these acceptance criteria must pass:

1. **`npm run dev` starts without errors** — both backend and frontend boot (run from repo root)
2. **`npm run build` succeeds** — `vite build` in frontend completes with no TS or CSS errors
3. **Tailwind classes work** — build output CSS contains Tailwind base styles
4. **Proxy configured** — `vite.config.ts` has `/api` proxy pointing to `localhost:3000` with prefix rewrite
