# Code Review: feat/6-annotation-prompts-crud

## Architectural violations

Nothing to pick apart here. The routes correctly delegate to `fastify.db.annotationPrompts`, use the established decorator pattern, schemas are imported from the shared schema layer, and no business logic leaked into the handlers. Autoload handles registration. No `fastify-plugin` misuse.

## Abstraction problems

Nothing to pick apart.

## Project patterns

### [PAT-1] PUT with partial body is semantically PATCH
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:43`
**What's wrong:** The route uses `PUT /:id` with `UpdateAnnotationPrompt` as the body schema, where every field is `Type.Optional(...)`. By HTTP semantics, PUT means full replacement — the client sends the complete resource representation. Partial updates are PATCH. Here the handler accepts `{ title: 'Updated' }` alone (no other fields) and merges it into the existing record, which is textbook PATCH behavior.
**Why it's bad:** Not a functional bug — the project plan explicitly says PUT, and this is a consistent choice across the planned API. But it establishes a precedent where every PUT in the project will actually behave like PATCH. Consumers will be surprised when they send a full PUT body and unused fields silently persist from the old state instead of being cleared. This becomes a real problem the moment someone sends `{ title: 'New', prompt: 'New', provider_id: 'new', language: 'en' }` expecting a clean replacement but `created_by` and `created_at` are immutable server-side fields — the distinction collapses. For now, the plan says PUT, so this is a design-level note, not a code-level defect.

### [PAT-2] Missing response schema for POST 400 error
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:31-41`
**What's wrong:** The POST route defines a response schema for `201` but not for `400`. When Fastify schema validation rejects a body (missing required fields), it returns 400 automatically. Without a response schema for 400, `fast-json-stringify` cannot serialize it, so Fastify falls back to `JSON.stringify`. More importantly, the 400 response shape is not documented in the route's schema metadata — which means any auto-generated OpenAPI/Swagger docs will omit it.
**Why it's bad:** The backend CLAUDE.md says "always define response schemas." The GET-by-ID, PUT, and DELETE routes all include `ErrorResponse` for their error status codes (404). POST is the odd one out — it omits the 400 case. The test at line 132 proves the 400 response happens, but the schema doesn't declare it.

### [PAT-3] Missing response schema for POST 400 and PUT 400
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:43-58`
**What's wrong:** Same as PAT-2, but for the PUT route. A PUT with an empty body `{}` is valid per the `UpdateAnnotationPrompt` schema (all fields optional), but Fastify body parsing can still fail (e.g., invalid JSON). Neither route declares a 400 response schema.
**Why it's bad:** Consistency. The 404 error responses are all declared, but 400s are not. If someone generates OpenAPI docs from these schemas, validation errors will be invisible.

## Data layer rules

Nothing to pick apart. Routes correctly delegate to the repository, "not found" returns null and the route converts to 404, no raw DB access.

## Code quality

### [QUAL-1] Redundant `existing` variable in PUT handler
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:53`
**What's wrong:** The PUT handler fetches `existing` via `getById()` only to check if it's null — the value is never used. Then it calls `update()` which internally also calls `getById()` again (in the local SQLite implementation, line 27-28 of `prompts.ts`). That's two SELECT queries for a single update operation.
**Why it's bad:** One extra DB round-trip per update request. For SQLite (synchronous, in-process) this is negligible. For Supabase (network round-trip to Postgres), it doubles the latency of every update. The pre-check is necessary for correct 404 behavior (since the local `update()` throws a generic Error, not an HTTP error, and the Supabase `update()` would return the row without error even if nothing matched), so the double-query is a consequence of the repository API design, not the route's fault. But worth noting.

### [QUAL-2] Same problem in DELETE handler
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:70`
**What's wrong:** Same pattern as QUAL-1. Fetches `existing` only to check existence, then calls `delete()`. Two queries for the local implementation. For Supabase, the delete doesn't tell you whether a row was actually deleted, so the pre-check is defensively correct.
**Why it's bad:** Same as above — extra round-trip. Acceptable given the repository contract, but not free.

### [QUAL-3] `send(null)` on 204 is a workaround, not a clean solution
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:75`
**What's wrong:** `reply.status(204).send(null)` is used because `FastifyPluginAsyncTypebox` with `Type.Null()` response schema requires an argument to `send()`. The execution log documents this as a deviation from the plan (`send()` failed TypeScript, so `send(null)` was used). The test correctly asserts `res.body` is `''`, so it works at runtime.
**Why it's bad:** `Type.Null()` as a response schema for 204 is an approximation. Null is not "no content" — it's a JSON value. `fast-json-stringify` will serialize `null` to the string `"null"` (4 bytes), but Fastify knows to send empty body for 204. This works today, but it's a coupling to Fastify's internal behavior around 204 + null handling. If that behavior changes in a future Fastify version, the response could start containing the literal string `null`.

## Potential bugs

### [BUG-1] TOCTOU race on update and delete
**Severity:** Minor
**File:** `backend/src/routes/annotation-prompts/index.ts:53-57, 70-74`
**What's wrong:** The GET-then-mutate pattern (`getById` then `update`/`delete`) has a time-of-check-to-time-of-use gap. Between the `getById()` check and the `update()`/`delete()` call, another request could delete the same record.
**Why it's bad:** For an internal tool with likely single-digit concurrent users, this is academic. The local SQLite implementation would throw an Error on update-after-delete (caught by Fastify as 500) and silently succeed on delete-after-delete. The Supabase implementation would throw on update (`.single()` fails) and silently succeed on delete. Not a real-world concern for this project, but the pattern doesn't degrade gracefully under concurrency.

## Testing violations

### [TEST-1] No test for response body structure on error responses
**Severity:** Minor
**File:** `backend/tests/routes/annotation-prompts.test.ts:87-94, 179-189, 224-231`
**What's wrong:** The 404 tests only assert `res.statusCode === 404`. They don't check that the response body matches the `ErrorResponse` schema (`{ statusCode, error, message }`). Similarly, the 400 test (line 132-142) only checks the status code.
**Why it's bad:** If `@fastify/sensible` changes its error response format, or if the `ErrorResponse` schema drifts from what sensible actually produces, these tests wouldn't catch it. The happy-path tests check response body thoroughly (e.g., `toMatchObject`), but the error paths are status-code-only.

### [TEST-2] No test for `created_by` field behavior
**Severity:** Minor
**File:** `backend/tests/routes/annotation-prompts.test.ts`
**What's wrong:** The `AnnotationPrompt` response schema includes `created_by: Type.Union([Type.String(), Type.Null()])`, but no test verifies what value it has when a prompt is created via the API. The `CreateAnnotationPrompt` TypeBox schema doesn't include `created_by`, so it should always be `null` when created through the route. No test asserts this.
**Why it's bad:** If someone accidentally adds `created_by` to the Create schema, or if the DB default changes, this behavior would silently change with no test catching it.

## Summary
- Fundamental issues: 0
- Major issues: 0
- Minor issues: 9 (PAT-1, PAT-2, PAT-3, QUAL-1, QUAL-2, QUAL-3, BUG-1, TEST-1, TEST-2)
- Overall assessment: Clean, correct CRUD implementation that faithfully follows the project plan and established patterns. The issues are all minor — a missing 400 schema, semantic PUT-vs-PATCH pedantry, double DB round-trips inherent to the repository contract, and some gaps in test assertions for error paths. Nothing here warrants blocking a merge.
