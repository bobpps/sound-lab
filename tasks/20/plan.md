# Frontend API Client + Shared Types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create typed frontend API entity types mirroring the backend read-model, a typed `fetch` wrapper with error handling, and a Vite dev proxy so `/api` requests reach the backend.

**Architecture:** Two new files under `frontend/src/` — `types/api.ts` for read-only entity interfaces and `lib/api-client.ts` for a thin typed `fetch` wrapper that returns parsed JSON or throws `ApiError`. The Vite proxy in `vite.config.ts` strips `/api` and forwards to `http://localhost:3000`.

**Tech Stack:** TypeScript 5.9, Vite 8 (proxy via `http-proxy-3`), native `fetch`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/types/api.ts` | Create | Read-model entity types mirroring backend |
| `frontend/src/lib/api-client.ts` | Create | `ApiError` class + typed fetch wrapper (`api.get`, `api.post`, `api.put`, `api.delete`, `api.fetchRaw`) |
| `frontend/vite.config.ts` | Modify | Add `server.proxy` for `/api` -> `http://localhost:3000` with path rewrite |

## TypeScript Constraints (from `tsconfig.app.json`)

- `erasableSyntaxOnly: true` — no `enum`, no `namespace`, no parameter properties
- `verbatimModuleSyntax: true` — must use `import type` for type-only imports
- `noUnusedLocals: true` / `noUnusedParameters: true` — no dead code
- `allowImportingTsExtensions: true` — existing code uses `.tsx`/`.ts` import extensions (see `main.tsx` importing `./App.tsx`), follow that convention

---

### Task 1: Create entity types — `frontend/src/types/api.ts`

**Files:**
- Create: `frontend/src/types/api.ts`

- [ ] **Step 1: Create the `types/` directory and `api.ts` with all entity types**

Create `frontend/src/types/api.ts` with the following content. These mirror the backend read-model types from `backend/src/db/types.ts` and `backend/src/providers/tts/types.ts`. No Create/Update types per YAGNI — those belong in feature-specific directories when needed.

```ts
// frontend/src/types/api.ts
// Read-model types mirroring backend entities.
// Create/Update types live in feature-specific directories (YAGNI).

// --- Provider ---

export type ProviderType = 'tts' | 'llm' | 'realtime';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  created_at: string;
}

// --- Dialog ---

export interface Dialog {
  id: number;
  title: string;
  description: string | null;
  language: string;
  created_by: string | null;
  created_at: string;
}

export interface DialogMessage {
  id: number;
  dialog_id: number;
  order: number;
  character: 1 | 2;
  text: string;
}

export interface DialogWithMessages extends Dialog {
  messages: DialogMessage[];
}

// --- Annotated Dialog ---

export interface AnnotatedDialog {
  id: number;
  dialog_id: number;
  provider_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
}

export interface AnnotatedMessage {
  id: number;
  annotated_dialog_id: number;
  dialog_message_id: number;
  text: string;
}

export interface AnnotatedDialogWithMessages extends AnnotatedDialog {
  messages: AnnotatedMessage[];
}

// --- Annotation Prompt ---

export interface AnnotationPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

// --- Agent Prompt ---

export interface AgentPrompt {
  id: number;
  title: string;
  provider_id: string;
  language: string;
  prompt: string;
  created_by: string | null;
  created_at: string;
}

// --- Voice ---

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}

// --- API Error Response ---

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
}
```

- [ ] **Step 2: Type-check the new file**

Run from the **frontend** directory:

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits 0 with no errors. If `tsc -b` is the project convention (the `build` script uses `tsc -b`), use that instead:

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: exits 0. The new file only contains `export interface`/`export type` declarations, so no unused-local issues.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/api.ts
git commit -m "feat(frontend): add read-model entity types mirroring backend"
```

---

### Task 2: Create API client — `frontend/src/lib/api-client.ts`

**Files:**
- Create: `frontend/src/lib/api-client.ts`
- Read (for reference): `frontend/src/types/api.ts` (created in Task 1)

- [ ] **Step 1: Create the `lib/` directory and `api-client.ts`**

Create `frontend/src/lib/api-client.ts` with the following content:

```ts
// frontend/src/lib/api-client.ts
import type { ApiErrorResponse } from '../types/api.ts';

const BASE_URL = '/api';

/**
 * Error thrown when the API returns a non-ok response.
 * Parses Fastify's { statusCode, error, message } shape.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body: ApiErrorResponse = await response.json();
      message = body.message || message;
    } catch {
      // Response body wasn't JSON — keep statusText
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

function buildUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete(path: string): Promise<void> {
    const response = await fetch(buildUrl(path), {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      let message = response.statusText;
      try {
        const body: ApiErrorResponse = await response.json();
        message = body.message || message;
      } catch {
        // Response body wasn't JSON — keep statusText
      }
      throw new ApiError(response.status, message);
    }
  },

  async fetchRaw(path: string, opts?: RequestInit): Promise<Response> {
    return fetch(buildUrl(path), opts);
  },
};
```

Key design decisions visible in the code:
- `BASE_URL = '/api'` — Vite proxy handles routing to backend (Task 3)
- `handleResponse<T>()` — shared logic for JSON parsing, 204 handling, and error extraction
- `ApiError` — parses Fastify's `{ statusCode, error, message }` response shape
- `delete` returns `Promise<void>` — does not parse a body, just checks ok/204
- `fetchRaw` — escape hatch for non-JSON responses (audio blobs, SSE, etc.)
- `import type` for `ApiErrorResponse` — required by `verbatimModuleSyntax`
- No parameter properties (`public readonly x` in constructor) — forbidden by `erasableSyntaxOnly`; `status` is declared as a class field and assigned in the constructor body

- [ ] **Step 2: Type-check both new files**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(frontend): add typed fetch wrapper with ApiError handling"
```

---

### Task 3: ~~Add Vite dev proxy~~ — ALREADY DONE by #19

**Status:** SKIPPED — Issue #19 (merged as PR #45) already configured the proxy in `frontend/vite.config.ts` with the exact same setup: `/api` → `http://localhost:3000` with path rewrite stripping `/api`.

- [ ] **Step 1: Update `vite.config.ts` with proxy configuration**

Replace the entire content of `frontend/vite.config.ts` with:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

This means:
- `GET /api/providers` -> `GET http://localhost:3000/providers`
- `POST /api/dialogs` -> `POST http://localhost:3000/dialogs`
- `DELETE /api/providers/elevenlabs` -> `DELETE http://localhost:3000/providers/elevenlabs`

- [ ] **Step 2: Type-check the config file**

The `vite.config.ts` is type-checked by `tsconfig.node.json` (which includes only `vite.config.ts`). Verify:

```bash
cd frontend && npx tsc -p tsconfig.node.json --noEmit
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat(frontend): add Vite dev proxy /api -> localhost:3000"
```

---

### Task 4: Full type-check and lint verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript type-check**

```bash
cd frontend && npx tsc -b --noEmit
```

Expected: exits 0. This checks both `tsconfig.app.json` (src/) and `tsconfig.node.json` (vite.config.ts).

- [ ] **Step 2: Run ESLint**

```bash
cd frontend && npx eslint .
```

Expected: exits 0 with no warnings or errors.

- [ ] **Step 3: Verify file structure**

```bash
ls -la frontend/src/types/api.ts frontend/src/lib/api-client.ts frontend/vite.config.ts
```

Expected: all three files exist.

- [ ] **Step 4: Final commit (if any lint/type fixes were needed)**

If Steps 1-2 required changes, commit them:

```bash
git add -A
git commit -m "fix(frontend): address lint/type-check issues in api client"
```

If no changes needed, skip this step.

---

## Summary of deliverables

| File | Purpose |
|---|---|
| `frontend/src/types/api.ts` | 11 types/interfaces: `ProviderType`, `Provider`, `Dialog`, `DialogMessage`, `DialogWithMessages`, `AnnotatedDialog`, `AnnotatedMessage`, `AnnotatedDialogWithMessages`, `AnnotationPrompt`, `AgentPrompt`, `Voice`, `ApiErrorResponse` |
| `frontend/src/lib/api-client.ts` | `ApiError` class + `api` object with `get<T>`, `post<T>`, `put<T>`, `delete`, `fetchRaw` methods |
| `frontend/vite.config.ts` | Dev proxy: `/api` -> `http://localhost:3000` with path rewrite stripping `/api` prefix |
