# Analysis — Issue #19: Frontend Dependencies + Tailwind + Vite Config

## 1. What the Task Requires

Install frontend runtime and dev dependencies, configure Tailwind CSS via the Vite plugin, set up a dev-server proxy for API calls, clean up the default Vite/React scaffolding CSS, and verify the dev server starts without errors.

### Concrete changes

| # | Action | Target file | Detail |
|---|--------|-------------|--------|
| 1 | Install runtime deps | `frontend/package.json` | `react-router-dom`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `clsx` |
| 2 | Install dev deps | `frontend/package.json` | `tailwindcss`, `@tailwindcss/vite` |
| 3 | Configure Vite | `frontend/vite.config.ts` | Add `@tailwindcss/vite` plugin, add `server.proxy` for `/api` -> `http://localhost:3000` with path rewrite stripping `/api` prefix |
| 4 | Replace CSS | `frontend/src/index.css` | Replace entire 112-line file with `@import "tailwindcss";` |
| 5 | Delete file | `frontend/src/App.css` | Remove (185 lines of Vite scaffolding CSS) |
| 6 | Update import | `frontend/src/App.tsx` | Remove `import './App.css'` (line 5) |
| 7 | Verify | — | `npm run dev` starts without errors |

## 2. Constraints from Project Guidance

### Root CLAUDE.md
- ESM everywhere (`"type": "module"`, `.js` extensions in imports) — Vite config is ESM already, no change needed.
- Verify UI with Playwright after UI-related tasks.
- TDD by default — though this task is configuration-only, no business logic to test.

### Frontend CLAUDE.md
- **Styling:** Tailwind CSS preferred; no runtime CSS-in-JS.
- **Vite plugin note:** CLAUDE.md says "Use `@vitejs/plugin-react-swc` for faster HMR" — BUT the actual project uses `@vitejs/plugin-react` v6.0.1 (which uses Oxc, not SWC or Babel). The CLAUDE.md is outdated on this point. **Do NOT switch plugins as part of this task.**
- **Proxy config:** `server.proxy: { '/api': { target: 'http://localhost:3000' } }`. The plan adds `rewrite: (path) => path.replace(/^\/api/, '')` to strip the `/api` prefix because backend routes are mounted at root (e.g., `/providers`, not `/api/providers`).
- React Compiler is active — no manual memoization.

### Backend CLAUDE.md
- Backend listens on port 3000 (`backend/src/index.ts`).
- Routes are at root level: `/providers`, `/dialogs`, `/annotations`, `/annotation-prompts`, `/agent-prompts`, `/health`.
- No `/api` prefix on backend routes — confirms the proxy rewrite is necessary.

## 3. Key Files and Current State

### `frontend/package.json`
- **dependencies:** Only `react` (^19.2.4) and `react-dom` (^19.2.4).
- **devDependencies:** `@eslint/js`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react` (^6.0.1), `eslint`, ESLint plugins, `globals`, `typescript` (~5.9.3), `vite` (^8.0.1).
- **type: "module"** — ESM.
- None of the target runtime/dev deps are installed yet.

### `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```
- Minimal config. No proxy, no Tailwind plugin. Only `@vitejs/plugin-react`.

### `frontend/src/index.css`
- 112 lines of custom CSS: CSS variables for theming (light/dark), root layout, typography, code styling.
- Imported in `main.tsx` (line 3): `import './index.css'`.
- **All of this will be replaced** with a single `@import "tailwindcss";` line.

### `frontend/src/App.css`
- 185 lines of Vite scaffolding CSS: `.counter`, `.hero`, `#center`, `#next-steps`, `#docs`, `#spacer`, `.ticks` styles.
- Imported in `App.tsx` (line 5): `import './App.css'`.
- **This file will be deleted.** The import in `App.tsx` must be removed.

### `frontend/src/App.tsx`
- Default Vite + React boilerplate component (counter, logos, links).
- **Line 5: `import './App.css'`** — must be removed when `App.css` is deleted.
- This component will likely be replaced entirely in a later task (Task 20: routing/layout), but for now we just need it not to crash.

### `frontend/src/main.tsx`
- **Line 3: `import './index.css'`** — stays. We replace the contents of `index.css`, not the import.
- Renders `<App />` into `#root` with `StrictMode`.

### `frontend/tsconfig.app.json`
- `target: "ES2023"`, `module: "ESNext"`, `moduleResolution: "bundler"`.
- `verbatimModuleSyntax: true` — import syntax must match the module's actual export kind.
- `jsx: "react-jsx"`.

### `frontend/tsconfig.node.json`
- Covers `vite.config.ts`.
- `verbatimModuleSyntax: true` — the `import tailwindcss from '@tailwindcss/vite'` must work with this setting. The `@tailwindcss/vite` package provides a default export, so this should be fine.

### `frontend/eslint.config.js`
- Standard ESLint flat config with TypeScript, React Hooks, and React Refresh plugins.
- No changes needed for this task.

## 4. Risks and Edge Cases

### Risk 1: App.css deletion breaks App.tsx
**Impact:** Build error / runtime crash if `import './App.css'` remains after file deletion.
**Mitigation:** Remove `import './App.css'` from `App.tsx` line 5.
**Side effect:** All CSS class-based styling in `App.tsx` will be unstyled (`.counter`, `.hero`, `.base`, `.framework`, `.vite`, `#center`, `#next-steps`, `#docs`, `#social`, `.ticks`, `#spacer`). The component will render but look broken. This is acceptable because:
1. The component is boilerplate that will be replaced in Task 20.
2. The issue explicitly says to delete App.css.

### Risk 2: index.css replacement removes dark mode / theme variables
**Impact:** Entire Vite scaffolding theme (CSS variables, typography, layout) is lost.
**Mitigation:** Not needed — the scaffolding theme is not part of the project's design system. Tailwind provides its own reset and utilities. Future tasks will build the actual design.

### Risk 3: `verbatimModuleSyntax` with `@tailwindcss/vite`
**Impact:** If `@tailwindcss/vite` doesn't export correctly for ESM with `verbatimModuleSyntax: true`, TypeScript will error on the import.
**Mitigation:** The `@tailwindcss/vite` package (Tailwind CSS v4) is designed for ESM and provides proper type declarations with a default export. The import `import tailwindcss from '@tailwindcss/vite'` should work. Verify during the build step.

### Risk 4: npm workspace dependency resolution
**Impact:** Running `npm install` in `frontend/` within a workspace monorepo may behave differently than in a standalone project.
**Mitigation:** Run `npm install --workspace=frontend <packages>` from the root, or run `npm install <packages>` from within the `frontend/` directory. Both approaches are valid with npm workspaces. The plan shows `cd frontend && npm install ...` which is fine.

### Risk 5: Proxy path rewrite correctness
**Impact:** If the rewrite regex is wrong, API calls will 404.
**Mitigation:** The rewrite `path.replace(/^\/api/, '')` transforms:
- `/api/providers` -> `/providers`
- `/api/dialogs/123/messages` -> `/dialogs/123/messages`
- `/api` -> `` (empty string, becomes `/` effectively)
This matches the backend route structure. Verify with a test request after dev server starts.

### Risk 6: Tailwind CSS v4 vs v3 syntax
**Impact:** The plan uses `@import "tailwindcss"` (v4 syntax). If for some reason an older version gets installed, this won't work.
**Mitigation:** The deps are `tailwindcss` (latest) and `@tailwindcss/vite` — these are Tailwind CSS v4 packages. The `@import "tailwindcss"` directive is the correct v4 approach (replacing the old `@tailwind base/components/utilities` directives from v3).

### Risk 7: CLAUDE.md mentions `@vitejs/plugin-react-swc`
**Impact:** Potential confusion — someone might switch to SWC plugin.
**Mitigation:** The actual `package.json` has `@vitejs/plugin-react` v6 (uses Oxc). Do NOT switch plugins in this task. This is a documentation issue to address separately (out of scope).

## 5. Assumptions

1. **Tailwind CSS v4** is the target (based on `@import "tailwindcss"` syntax and `@tailwindcss/vite` plugin).
2. **No `tailwind.config.ts` needed** — the plan explicitly notes "(not needed with @tailwindcss/vite)" in the file structure diagram. Tailwind v4 with the Vite plugin uses CSS-first configuration.
3. **App.tsx stays as-is** (minus the CSS import) — it will be replaced in Task 20.
4. **No tests needed for this task** — it's pure configuration. Verification is "dev server starts and Tailwind classes work."
5. **The `frontend/src/vite-env.d.ts`** file (if it exists) doesn't need changes.
6. **zod** is already used in the backend; adding it to the frontend is for form validation schemas (React Hook Form + Zod resolver pattern).

## 6. Unknowns Resolved Through Research

| Question | Answer |
|----------|--------|
| Does App.tsx import App.css? | Yes, line 5: `import './App.css'`. Must be removed. |
| Does main.tsx import index.css? | Yes, line 3: `import './index.css'`. Stays as-is. |
| Are any target deps already installed? | No. Only `react` and `react-dom` are in dependencies. |
| Does the backend have an `/api` prefix? | No. Routes are at root: `/providers`, `/dialogs`, etc. Proxy rewrite is necessary. |
| What port does the backend listen on? | 3000 (`backend/src/index.ts`). |
| Which Vite React plugin is used? | `@vitejs/plugin-react` v6.0.1 (Oxc-based), not the SWC variant. |
| Does `verbatimModuleSyntax` affect the Tailwind import? | `tsconfig.node.json` (which covers `vite.config.ts`) has it enabled. `@tailwindcss/vite` provides a proper default ESM export, so `import tailwindcss from '@tailwindcss/vite'` should work. |
| Is there a `tailwind.config.ts` or `postcss.config.ts`? | No. Not needed with Tailwind v4 + `@tailwindcss/vite`. |
| Are there other CSS files to consider? | No other `.css` files exist in `frontend/src/`. |

## 7. Exact Vite Config (from plan)

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

## 8. Implementation Order

1. Install runtime deps (`npm install react-router-dom @tanstack/react-query zustand react-hook-form @hookform/resolvers zod clsx` in frontend workspace)
2. Install dev deps (`npm install -D tailwindcss @tailwindcss/vite` in frontend workspace)
3. Update `frontend/vite.config.ts` — add tailwindcss plugin and server.proxy
4. Replace `frontend/src/index.css` contents with `@import "tailwindcss";`
5. Remove `import './App.css'` from `frontend/src/App.tsx`
6. Delete `frontend/src/App.css`
7. Run `npm run dev` to verify
8. Optionally test Tailwind by adding a utility class to App.tsx and checking it renders
9. Commit
