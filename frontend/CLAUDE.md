# CLAUDE.md

Best practices for the frontend (React 19, Vite 8, TypeScript).

## Architecture Decisions

**Feature-based structure** — organize by feature (`features/datasets/`, `features/tts/`, etc.), not by file type. Each feature contains its own `api/`, `components/`, `hooks/`, `types/`. Shared code lives in top-level `components/`, `hooks/`, `lib/`, `utils/`.

**No cross-feature imports** — features compose at the route/app level only.

**No barrel files** (`index.ts` re-exports) — they break tree-shaking and cause circular deps.

**React Compiler is active** — do NOT use `useMemo`/`useCallback`/`React.memo` by default. Manual memoization only at third-party interop boundaries or provably expensive computations.

**`forwardRef` is deprecated** — in React 19, `ref` is a regular prop.

## Technology Choices

| Concern | Choice |
|---|---|
| Server state | **TanStack Query** (`useQuery`, `useMutation`) |
| Client state | **Zustand** (shared) / **Context** (theme, auth) / **useState** (local) |
| Forms | **React Hook Form** + **Zod** (one schema = TS type + validation) |
| Routing | **React Router v7** (layout routes, `<Outlet />`, lazy loading) |
| Styling | **Tailwind CSS** (preferred) or CSS Modules. No runtime CSS-in-JS. |
| HTTP | Typed `fetch` wrapper in `lib/api-client.ts`. Feature query hooks in `features/*/api/`. |
| Testing | **Vitest** + **React Testing Library** + **MSW** for API mocking |

## React 19 Patterns

- `use()` — read Promises/Context in render, works with Suspense. Can be called conditionally.
- `useActionState(fn, initial)` → `[state, formAction, isPending]` for form actions.
- `useOptimistic(state, updateFn)` for instant UI feedback before server confirmation.
- Wrap data components in `<ErrorBoundary>` + `<Suspense>`. Use `react-error-boundary` for functional API.

## Vite

- Only `VITE_`-prefixed env vars are exposed to client code. Never put secrets in them.
- Use `@vitejs/plugin-react-swc` for faster HMR.
- Proxy backend in dev: `server.proxy: { '/api': { target: 'http://localhost:3000' } }`.

## Testing

- Query priority: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`.
- `userEvent` over `fireEvent`. Colocate `*.test.tsx` next to source files.
- Custom `renderWithProviders` wrapping QueryClient, Router, etc.
