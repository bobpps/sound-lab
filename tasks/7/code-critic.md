# Code Review: feat/7-agent-prompts-crud

## Architectural violations

### [ARCH-1] PUT with all-optional body is semantically wrong — **Major**
**File:** `backend/src/routes/agent-prompts/index.ts:40-54`
**What's wrong:** The route uses `PUT` with `S.UpdateAgentPrompt` as the body schema. `UpdateAgentPrompt` has every field marked `Type.Optional(...)`. PUT semantics mean "replace the entire resource" — every field should be required. Partial updates are what PATCH is for.
**Why it's bad:** A client can `PUT /agent-prompts/1` with `{}` (empty body) and the request passes validation, hitting the DB `update()` with no fields, silently doing nothing and returning the unchanged resource. This is confusing API behavior. Worse, if a client sends `{ title: "New" }` expecting PUT semantics, they'll be surprised that `prompt`, `provider_id`, and `language` are preserved from the old record rather than being nulled/rejected.

### [ARCH-2] Check-then-act race condition on PUT and DELETE — **Minor**
**File:** `backend/src/routes/agent-prompts/index.ts:50-53` and `backend/src/routes/agent-prompts/index.ts:65-68`
**What's wrong:** Both PUT and DELETE do a `getById()` check, then a separate `update()`/`delete()` call. Between the two calls, another request could delete the same resource.
**Why it's bad:** With SQLite this is practically harmless (single-writer). With Supabase under concurrent load, the second call could fail with an unexpected error instead of the clean 404 the code intends. The repository `update()` already does its own existence check and throws — so the route-level check is redundant and introduces a TOCTOU window. Not critical for an internal tool, but it's sloppy.

## Schema / data layer issues

### [DATA-1] TypeBox schema for CreateAgentPrompt is missing `created_by` — **Major**
**File:** `backend/src/schemas/prompt.ts:41-46`
**What's wrong:** The `CreateAgentPrompt` TypeBox schema only has `title`, `provider_id`, `language`, `prompt`. The DB type `CreateAgentPrompt` in `types.ts:155` has an optional `created_by?: string`. The route body schema has no way to accept `created_by` from the client.
**Why it's bad:** The `created_by` field is permanently `null` for every agent prompt created through the API. If a future auth system needs to pass a user identifier through the request body (before JWT-based extraction is wired up), the schema blocks it. The same omission exists in `CreateAnnotationPrompt` (line 14-19), suggesting it was copy-pasted. The DB layer accepts it, the schema strips it — this is a silent data loss at the validation boundary. Whether this is intentional or an oversight is unclear, but it's a contract mismatch between TypeBox schemas and DB types that should at minimum be documented.

### [DATA-2] UpdateAgentPrompt schema accepts empty objects — **Minor**
**File:** `backend/src/schemas/prompt.ts:49-54`
**What's wrong:** All fields in `UpdateAgentPrompt` are `Type.Optional(...)`. TypeBox will happily validate `{}` as a valid body. Combined with the PUT route (see ARCH-1), you can send a meaningless update.
**Why it's bad:** There's no `minProperties: 1` constraint. A no-op update still hits the database, reads the current row, writes identical values back, and returns 200. Wasted work, misleading success response.

## Code quality

### [QUAL-1] Redundant variable in PUT handler — **Minor**
**File:** `backend/src/routes/agent-prompts/index.ts:50-53`
**What's wrong:** The handler fetches `existing` purely for the 404 check, then calls `update()` which internally fetches the same row again (see `local/prompts.ts:63-64`). The `existing` variable is never used beyond the null check.
**Why it's bad:** Two reads for one write. The repository's `update()` already throws on not-found. The route could catch that throw instead of doing a redundant SELECT. Same pattern on DELETE (line 65-66) — `existing` is fetched, checked, discarded, then `delete()` runs independently.

### [QUAL-2] Missing blank line between GET /:id and PUT /:id — **Minor**
**File:** `backend/src/routes/agent-prompts/index.ts:39-40`
**What's wrong:** There's a blank line between every other route registration (after GET /, after POST /, after PUT /), but not between `GET /:id` (ends line 39) and `PUT /:id` (starts line 40).
**Why it's bad:** Inconsistency in spacing. Every other route block has a separator. Minor, but it signals careless copy-paste.

## Testing issues

### [TEST-1] Hardcoded auto-increment ID assumption — **Minor**
**File:** `backend/tests/routes/agent-prompts.test.ts:96`
**What's wrong:** `expect(body.id).toBe(1)` — the test assumes the first inserted row always gets ID 1.
**Why it's bad:** This is true for in-memory SQLite (fresh DB each test). But if the test helper or migration ever pre-seeds data, or if the test order changes, this breaks. It's a brittle assertion. Checking `typeof body.id === 'number'` or `body.id > 0` would test the same intent without coupling to auto-increment sequence.

### [TEST-2] No test for empty-body PUT — **Minor**
**File:** `backend/tests/routes/agent-prompts.test.ts:116-143`
**What's wrong:** The PUT tests cover partial update and 404, but never test `PUT /agent-prompts/:id` with `{}` (empty body). Given the schema accepts it (see DATA-2), the behavior should be explicitly verified.
**Why it's bad:** If someone later adds `minProperties` validation or changes the update logic, there's no test documenting the expected behavior of a no-field update.

### [TEST-3] No validation tests beyond the single 400 case — **Minor**
**File:** `backend/tests/routes/agent-prompts.test.ts:105-113`
**What's wrong:** There's one validation test: POST with `{ title: 'Incomplete' }` expects 400. There are no tests for: invalid types (number where string expected), extra unknown fields (are they stripped or rejected?), empty strings, extremely long strings, or PUT with invalid types.
**Why it's bad:** The TypeBox schema is the validation boundary. A single missing-fields test doesn't exercise it meaningfully. What happens when `provider_id` is `123` (number)? What happens when `prompt` is `""` (empty string)? These are real edge cases for a prompt management API.

## Summary

| Severity | Count |
|---|---|
| Fundamental | 0 |
| Major | 2 |
| Minor | 6 |

**Overall assessment:** Clean, conventional CRUD code that follows the project's established patterns correctly. The two major issues — PUT-vs-PATCH semantics and the `created_by` schema omission — are design-level concerns that should be resolved before merge. The minor issues are typical first-pass oversights: redundant DB reads, a missing edge-case test, a brittle ID assertion. Nothing architecturally broken, but the PUT semantics question deserves a deliberate decision, not a default.
