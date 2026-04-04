# TypeBox Request/Response Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create TypeBox schemas for all entities in `backend/src/schemas/`, providing both JSON Schema validation/serialization and TypeScript types for Fastify route handlers.

**Architecture:** Each schema file mirrors a domain area from `backend/src/db/types.ts`. Schemas use the TypeBox pattern where `const Schema = Type.Object({...})` defines the runtime JSON Schema and `type Schema = Static<typeof Schema>` extracts the TypeScript type. Create variants omit server-assigned fields (`created_by`, `created_at`) and parent IDs that come from URL params. Common param/error schemas live in `common.ts`.

**Tech Stack:** `@sinclair/typebox` ^0.34.49, `@fastify/type-provider-typebox` ^6.1.0, TypeScript 5 with `strict: true`, ESM with `.js` import extensions.

---

## File Structure

All files are new creations in `backend/src/schemas/`:

| File | Responsibility |
|------|---------------|
| `backend/src/schemas/common.ts` | Shared param schemas (`IdParam`, `StringIdParam`) and `ErrorResponse` |
| `backend/src/schemas/provider.ts` | Provider entity schemas + `SetKeyBody`, `ProviderTypeQuery` |
| `backend/src/schemas/dialog.ts` | Dialog, DialogMessage, and composite schemas + params |
| `backend/src/schemas/annotation.ts` | AnnotatedDialog, AnnotatedMessage schemas + params |
| `backend/src/schemas/prompt.ts` | AnnotationPrompt and AgentPrompt schemas |

No existing files are modified. No test files are created (these are pure type/schema definitions validated by the TypeScript compiler).

---

## Conventions

Every schema file follows this exact pattern:

```typescript
import { Type, type Static } from '@sinclair/typebox';

// Runtime JSON Schema object
export const SchemaName = Type.Object({
  field: Type.String(),
});

// TypeScript type extracted from the schema
export type SchemaName = Static<typeof SchemaName>;
```

Key rules:
- ESM imports: `import { Type, type Static } from '@sinclair/typebox';` (no `.js` extension needed for node_modules)
- `strict: true` in tsconfig means optional fields MUST use `Type.Optional()`
- Nullable fields use `Type.Union([Type.String(), Type.Null()])`
- Create schemas omit `created_by` (server-assigned) and parent IDs (from URL params)
- Response schemas include all fields (for `fast-json-stringify` serialization)
- Reference pattern: `backend/src/routes/health/index.ts` line 1-6

---

### Task 1: Common Schemas

**Files:**
- Create: `backend/src/schemas/common.ts`

- [ ] **Step 1: Create the schemas directory**

```bash
mkdir -p backend/src/schemas
```

- [ ] **Step 2: Create `backend/src/schemas/common.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

/** Param schema for routes with numeric :id */
export const IdParam = Type.Object({
  id: Type.Number(),
});
export type IdParam = Static<typeof IdParam>;

/** Param schema for routes with string :id (e.g., provider IDs) */
export const StringIdParam = Type.Object({
  id: Type.String(),
});
export type StringIdParam = Static<typeof StringIdParam>;

/** Standard error response body (matches Fastify's default error format) */
export const ErrorResponse = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  message: Type.String(),
});
export type ErrorResponse = Static<typeof ErrorResponse>;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/schemas/common.ts
git commit -m "feat(schemas): add common param and error schemas"
```

---

### Task 2: Provider Schemas

**Files:**
- Create: `backend/src/schemas/provider.ts`

Reference: `backend/src/db/types.ts` lines 1-23 (Provider, CreateProvider, UpdateProvider)

- [ ] **Step 1: Create `backend/src/schemas/provider.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

/** Union type for provider categories */
export const ProviderType = Type.Union([
  Type.Literal('tts'),
  Type.Literal('llm'),
  Type.Literal('realtime'),
]);
export type ProviderType = Static<typeof ProviderType>;

/** Full provider entity (response schema) */
export const Provider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
  enabled: Type.Boolean(),
  created_at: Type.String(),
});
export type Provider = Static<typeof Provider>;

/** Body for POST /providers */
export const CreateProvider = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: ProviderType,
});
export type CreateProvider = Static<typeof CreateProvider>;

/** Body for PATCH /providers/:id */
export const UpdateProvider = Type.Object({
  name: Type.Optional(Type.String()),
  type: Type.Optional(ProviderType),
  enabled: Type.Optional(Type.Boolean()),
});
export type UpdateProvider = Static<typeof UpdateProvider>;

/** Body for PUT /providers/:id/key */
export const SetKeyBody = Type.Object({
  key: Type.String(),
});
export type SetKeyBody = Static<typeof SetKeyBody>;

/** Query string for GET /providers?type=tts */
export const ProviderTypeQuery = Type.Object({
  type: Type.Optional(ProviderType),
});
export type ProviderTypeQuery = Static<typeof ProviderTypeQuery>;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/provider.ts
git commit -m "feat(schemas): add provider request/response schemas"
```

---

### Task 3: Dialog Schemas

**Files:**
- Create: `backend/src/schemas/dialog.ts`

Reference: `backend/src/db/types.ts` lines 25-71 (Dialog, DialogMessage, DialogWithMessages, Create/Update variants)

- [ ] **Step 1: Create `backend/src/schemas/dialog.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

/** Single message within a dialog */
export const DialogMessage = Type.Object({
  id: Type.Number(),
  dialog_id: Type.Number(),
  order: Type.Number(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});
export type DialogMessage = Static<typeof DialogMessage>;

/** Dialog entity (response schema) */
export const Dialog = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  language: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type Dialog = Static<typeof Dialog>;

/** Dialog with nested messages array (response for GET /dialogs/:id) */
export const DialogWithMessages = Type.Intersect([
  Dialog,
  Type.Object({ messages: Type.Array(DialogMessage) }),
]);
export type DialogWithMessages = Static<typeof DialogWithMessages>;

/** Body for POST /dialogs (created_by omitted — set server-side) */
export const CreateDialog = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.String()),
  language: Type.String(),
});
export type CreateDialog = Static<typeof CreateDialog>;

/** Body for PATCH /dialogs/:id */
export const UpdateDialog = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
});
export type UpdateDialog = Static<typeof UpdateDialog>;

/** Body for POST /dialogs/:dialogId/messages (dialog_id omitted — from URL param) */
export const CreateDialogMessage = Type.Object({
  order: Type.Number(),
  character: Type.Union([Type.Literal(1), Type.Literal(2)]),
  text: Type.String(),
});
export type CreateDialogMessage = Static<typeof CreateDialogMessage>;

/** Body for PATCH /dialogs/:dialogId/messages/:messageId */
export const UpdateDialogMessage = Type.Object({
  character: Type.Optional(Type.Union([Type.Literal(1), Type.Literal(2)])),
  text: Type.Optional(Type.String()),
});
export type UpdateDialogMessage = Static<typeof UpdateDialogMessage>;

/** Params for routes scoped to a dialog: /dialogs/:dialogId/... */
export const DialogIdParam = Type.Object({
  dialogId: Type.Number(),
});
export type DialogIdParam = Static<typeof DialogIdParam>;

/** Params for message routes: /dialogs/:dialogId/messages/:messageId */
export const MessageIdParam = Type.Object({
  dialogId: Type.Number(),
  messageId: Type.Number(),
});
export type MessageIdParam = Static<typeof MessageIdParam>;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/dialog.ts
git commit -m "feat(schemas): add dialog and message request/response schemas"
```

---

### Task 4: Annotation Schemas

**Files:**
- Create: `backend/src/schemas/annotation.ts`

Reference: `backend/src/db/types.ts` lines 73-110 (AnnotatedDialog, AnnotatedMessage, AnnotatedDialogWithMessages, Create/Update variants)

- [ ] **Step 1: Create `backend/src/schemas/annotation.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

/** Annotated dialog entity (response schema) */
export const AnnotatedDialog = Type.Object({
  id: Type.Number(),
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AnnotatedDialog = Static<typeof AnnotatedDialog>;

/** Single annotated message */
export const AnnotatedMessage = Type.Object({
  id: Type.Number(),
  annotated_dialog_id: Type.Number(),
  dialog_message_id: Type.Number(),
  text: Type.String(),
});
export type AnnotatedMessage = Static<typeof AnnotatedMessage>;

/** Annotated dialog with nested messages (response for GET /annotations/:id) */
export const AnnotatedDialogWithMessages = Type.Intersect([
  AnnotatedDialog,
  Type.Object({ messages: Type.Array(AnnotatedMessage) }),
]);
export type AnnotatedDialogWithMessages = Static<typeof AnnotatedDialogWithMessages>;

/** Body for POST /annotations (created_by omitted — set server-side) */
export const CreateAnnotatedDialog = Type.Object({
  dialog_id: Type.Number(),
  provider_id: Type.String(),
  title: Type.String(),
});
export type CreateAnnotatedDialog = Static<typeof CreateAnnotatedDialog>;

/** Body for POST /annotations/:id/messages (annotated_dialog_id omitted — from URL param) */
export const CreateAnnotatedMessage = Type.Object({
  dialog_message_id: Type.Number(),
  text: Type.String(),
});
export type CreateAnnotatedMessage = Static<typeof CreateAnnotatedMessage>;

/** Body for PATCH /annotations/:id/messages/:messageId */
export const UpdateAnnotatedMessage = Type.Object({
  text: Type.String(),
});
export type UpdateAnnotatedMessage = Static<typeof UpdateAnnotatedMessage>;

/** Params for annotation routes: /annotations/:id */
export const AnnotationIdParam = Type.Object({
  id: Type.Number(),
});
export type AnnotationIdParam = Static<typeof AnnotationIdParam>;

/** Params for annotation message routes: /annotations/:id/messages/:messageId */
export const AnnotationMessageIdParam = Type.Object({
  id: Type.Number(),
  messageId: Type.Number(),
});
export type AnnotationMessageIdParam = Static<typeof AnnotationMessageIdParam>;

/** Params for listing annotations by dialog: /dialogs/:dialogId/annotations */
export const DialogAnnotationsParam = Type.Object({
  dialogId: Type.Number(),
});
export type DialogAnnotationsParam = Static<typeof DialogAnnotationsParam>;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/annotation.ts
git commit -m "feat(schemas): add annotation request/response schemas"
```

---

### Task 5: Prompt Schemas

**Files:**
- Create: `backend/src/schemas/prompt.ts`

Reference: `backend/src/db/types.ts` lines 112-164 (AnnotationPrompt, AgentPrompt, Create/Update variants for both)

- [ ] **Step 1: Create `backend/src/schemas/prompt.ts`**

```typescript
import { Type, type Static } from '@sinclair/typebox';

/** Annotation prompt entity (response schema) */
export const AnnotationPrompt = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AnnotationPrompt = Static<typeof AnnotationPrompt>;

/** Body for POST /annotation-prompts (created_by omitted — set server-side) */
export const CreateAnnotationPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
});
export type CreateAnnotationPrompt = Static<typeof CreateAnnotationPrompt>;

/** Body for PATCH /annotation-prompts/:id */
export const UpdateAnnotationPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
});
export type UpdateAnnotationPrompt = Static<typeof UpdateAnnotationPrompt>;

/** Agent prompt entity (response schema) */
export const AgentPrompt = Type.Object({
  id: Type.Number(),
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
  created_by: Type.Union([Type.String(), Type.Null()]),
  created_at: Type.String(),
});
export type AgentPrompt = Static<typeof AgentPrompt>;

/** Body for POST /agent-prompts (created_by omitted — set server-side) */
export const CreateAgentPrompt = Type.Object({
  title: Type.String(),
  provider_id: Type.String(),
  language: Type.String(),
  prompt: Type.String(),
});
export type CreateAgentPrompt = Static<typeof CreateAgentPrompt>;

/** Body for PATCH /agent-prompts/:id */
export const UpdateAgentPrompt = Type.Object({
  title: Type.Optional(Type.String()),
  provider_id: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  prompt: Type.Optional(Type.String()),
});
export type UpdateAgentPrompt = Static<typeof UpdateAgentPrompt>;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas/prompt.ts
git commit -m "feat(schemas): add prompt request/response schemas"
```

---

### Task 6: Final Verification

**Files:**
- All files from Tasks 1-5

This task verifies all schemas compile together and the full schema count matches expectations.

- [ ] **Step 1: Run full TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors (exit code 0)

- [ ] **Step 2: Verify schema count**

Run: `cd backend && grep -c "^export const" src/schemas/*.ts`
Expected totals per file:
- `common.ts`: 3 (IdParam, StringIdParam, ErrorResponse)
- `provider.ts`: 6 (ProviderType, Provider, CreateProvider, UpdateProvider, SetKeyBody, ProviderTypeQuery)
- `dialog.ts`: 9 (DialogMessage, Dialog, DialogWithMessages, CreateDialog, UpdateDialog, CreateDialogMessage, UpdateDialogMessage, DialogIdParam, MessageIdParam)
- `annotation.ts`: 9 (AnnotatedDialog, AnnotatedMessage, AnnotatedDialogWithMessages, CreateAnnotatedDialog, CreateAnnotatedMessage, UpdateAnnotatedMessage, AnnotationIdParam, AnnotationMessageIdParam, DialogAnnotationsParam)
- `prompt.ts`: 6 (AnnotationPrompt, CreateAnnotationPrompt, UpdateAnnotationPrompt, AgentPrompt, CreateAgentPrompt, UpdateAgentPrompt)

Grand total: **33** `export const` lines. Each also has a matching `export type` line (33 type aliases).

- [ ] **Step 3: Run existing tests to confirm nothing is broken**

Run: `cd backend && npm test`
Expected: all existing tests pass

- [ ] **Step 4: Final commit (if any fixups were needed)**

```bash
git add backend/src/schemas/
git commit -m "fix(schemas): address compilation issues from verification"
```

Only commit if Step 1 or Step 3 revealed issues that required fixes. If everything passed cleanly, skip this step.
