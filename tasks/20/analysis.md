# Analysis -- Issue #20: Frontend API Client + Shared Types

## What the task requires

Create two new files in the frontend:

1. **`frontend/src/types/api.ts`** -- Mirror backend entity types as plain TypeScript interfaces (no runtime, no TypeBox). These are read-model types only.
2. **`frontend/src/lib/api-client.ts`** -- Typed `fetch` wrapper with generics for JSON endpoints and a raw-fetch escape hatch for binary data (audio blobs).

## Constraints from project guidance

| Constraint | Source | Impact |
|---|---|---|
| ESM everywhere, `.js` extensions in imports | Root `CLAUDE.md` | Import paths in both new files must use `.js` extensions |
| Feature-based structure, shared code in `lib/`, `types/` | `frontend/CLAUDE.md` | `types/api.ts` and `lib/api-client.ts` are top-level shared -- correct placement |
| No barrel files (`index.ts` re-exports) | `frontend/CLAUDE.md` | Do NOT create `types/index.ts` or `lib/index.ts` |
| `verbatimModuleSyntax: true` in tsconfig | `frontend/tsconfig.app.json` | Must use `import type` for type-only imports |
| `noUnusedLocals: true`, `noUnusedParameters: true` | `frontend/tsconfig.app.json` | Every exported type must be intentional; no dead code |
| `moduleResolution: "bundler"` | `frontend/tsconfig.app.json` | `.js` extensions are valid even though source is `.ts` |
| `allowImportingTsExtensions: true` | `frontend/tsconfig.app.json` | Can alternatively use `.ts` extensions in imports, but `.js` is the project convention |
| `erasableSyntaxOnly: true` | `frontend/tsconfig.app.json` | No `enum`, no `namespace`, no parameter properties. Use `type` unions instead of enums. |
| `"type": "module"` in package.json | `frontend/package.json` | ESM confirmed |
| HTTP: typed `fetch` wrapper in `lib/api-client.ts` | `frontend/CLAUDE.md` | Exact file path matches the issue spec |
| Vite proxy: `/api` -> backend | `frontend/CLAUDE.md` | Proxy config needed in `vite.config.ts` (out of scope for this issue but needed at runtime) |

## Key files and systems involved

### Files to create:
- `frontend/src/types/api.ts` -- entity types
- `frontend/src/lib/api-client.ts` -- fetch wrapper

### Backend source files (types to mirror):
- `backend/src/db/types.ts` -- `Provider`, `ProviderType`, `Dialog`, `DialogMessage`, `DialogWithMessages`, `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `AnnotationPrompt`, `AgentPrompt`
- `backend/src/providers/tts/types.ts` -- `IVoice` (rename to `Voice` on frontend)

### Backend routes (endpoints the client will call):
| Route file | Prefix | Endpoints |
|---|---|---|
| `routes/providers/index.ts` | `/providers` | GET /, POST /, GET /:id, PUT /:id, DELETE /:id, PUT /:id/key, GET /:id/key |
| `routes/dialogs/index.ts` | `/dialogs` | GET /, POST /, GET /:dialogId, PUT /:dialogId, DELETE /:dialogId, POST /:dialogId/messages, PUT /:dialogId/messages/:messageId, DELETE /:dialogId/messages/:messageId, GET /:dialogId/annotations, POST /:dialogId/annotations |
| `routes/annotations/index.ts` | `/annotations` | GET /:id, DELETE /:id, POST /:id/messages, PUT /:id/messages/:messageId, DELETE /:id/messages/:messageId |
| `routes/annotation-prompts/index.ts` | `/annotation-prompts` | GET /, POST /, GET /:id, PUT /:id, DELETE /:id |
| `routes/agent-prompts/index.ts` | `/agent-prompts` | GET /, POST /, GET /:id, PUT /:id, DELETE /:id |
| `routes/health/index.ts` | `/health` | GET / |

### Backend error response format (from `schemas/common.ts`):
```ts
{ statusCode: number; error: string; message: string }
```
This is Fastify's `@fastify/sensible` error shape. The `ApiError` class should parse this.

## Voice type handling

Backend defines `IVoice` in `backend/src/providers/tts/types.ts` using the `I`-prefix convention (interface prefix). The frontend should drop the prefix and name it `Voice`:

```ts
// backend (IVoice)
export interface IVoice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

// frontend (Voice) -- identical shape, different name
export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}
```

No renaming of fields, only the type name changes.

## Create/Update types -- scope decision

The issue explicitly lists only **read-model types** (entity types returned by the API). It does NOT mention:
- `CreateProvider`, `UpdateProvider`
- `CreateDialog`, `UpdateDialog`, `CreateDialogMessage`, `UpdateDialogMessage`
- `CreateAnnotatedDialog`, `CreateAnnotatedMessage`, `UpdateAnnotatedMessage`
- `CreateAnnotationPrompt`, `UpdateAnnotationPrompt`
- `CreateAgentPrompt`, `UpdateAgentPrompt`

**Recommendation:** Do NOT include Create/Update types now. They will be needed when feature-specific query hooks and forms are built (future issues). Including them prematurely would violate YAGNI and would also make `types/api.ts` unnecessarily large. Feature-specific mutation types should live in their `features/*/types/` directories when needed.

**Exception:** If the api-client `post<T>()` and `put<T>()` signatures accept a generic `body` parameter typed as `unknown` or `Record<string, unknown>`, no mutation types are needed in the client itself. Type safety for mutations comes from the calling code (query hooks), not the fetch wrapper.

## API Client design decisions

### Base URL
The issue specifies `/api` as the base URL. However, the backend currently serves routes at root level (`/providers`, `/dialogs`, etc.) without an `/api` prefix. This means:

- The Vite dev proxy must strip `/api` and forward to `http://localhost:3000`. Config: `server.proxy['/api'] = { target: 'http://localhost:3000', rewrite: path => path.replace(/^\/api/, '') }`.
- OR the backend gets an `/api` prefix added (unlikely -- out of scope for this issue).

The api-client should use `BASE_URL = '/api'` as specified. The proxy stripping is a separate concern (vite.config.ts update, likely part of issue #19 or done alongside this task).

### Method signatures
```ts
api.get<T>(path: string): Promise<T>
api.post<T>(path: string, body?: unknown): Promise<T>
api.put<T>(path: string, body?: unknown): Promise<T>
api.delete(path: string): Promise<void>
api.fetchRaw(path: string, opts?: RequestInit): Promise<Response>
```

### Error handling
- Non-ok responses: parse JSON body for `{ message }`, throw `ApiError(status, message)`.
- 204 responses: return `undefined` (cast via `as T` or `as unknown as T` for generic return).

### ApiError class
```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## Risks and assumptions

| Risk / Assumption | Mitigation |
|---|---|
| Backend has no `/api` prefix, but client uses `/api` base | Vite proxy with rewrite will bridge the gap. Document this dependency. |
| Issue #19 (frontend deps + Tailwind) not merged yet | Task-context says "not blocking". The two new files are pure TS with no external deps. |
| `erasableSyntaxOnly` prevents `enum` use | Use `type ProviderType = 'tts' \| 'llm' \| 'realtime'` (string union), not `enum`. Already the pattern in backend's `types.ts`. |
| Types may drift from backend over time | Acceptable trade-off. A shared package or codegen could be added later. The types are simple and stable. |
| No TTS/voice endpoints exist in routes yet | `Voice` type is still needed because the TTS features will come. The type is specified in the issue. |
| `fetchRaw` return type is `Response` (native) | Callers handle `.blob()` / `.arrayBuffer()` themselves. This is intentional for audio data. |

## Unknowns resolved

1. **Import extension convention:** `.js` extensions per root CLAUDE.md (ESM). Confirmed by `moduleResolution: "bundler"` which supports this.
2. **Vite proxy config:** Not yet set up in `vite.config.ts`. The api-client assumes `/api` prefix; proxy must strip it. This is a known dependency but may be addressed in this task or a companion task.
3. **Error response shape:** Fastify + `@fastify/sensible` produces `{ statusCode, error, message }`. ApiError should extract `message` from this.
4. **204 return behavior:** The generic `<T>` return type means `api.delete` should be `Promise<void>` (or `Promise<undefined>`). For PUT/POST that return 204 (like `PUT /providers/:id/key`), the caller knows to expect `undefined`.
5. **`erasableSyntaxOnly`:** Confirmed in tsconfig. No enums, no namespaces. All types must be `type` aliases or `interface` declarations.
6. **Existing frontend code:** The frontend is a fresh Vite scaffold with only `App.tsx`, `main.tsx`, `App.css`, `index.css`, and assets. No existing `lib/` or `types/` directories -- they will be created.
