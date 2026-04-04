# Code Review: feat/4-providers-crud

## Potential bugs

### [BUG-1] Duplicate detection works only on SQLite, broken on Supabase
**Severity: Major**
**File:** `backend/src/routes/providers/index.ts:34`
**What's wrong:** The POST handler catches duplicate errors by matching `err.message.includes('UNIQUE constraint failed')`. This is the SQLite error string. When running on Supabase/Postgres, a duplicate insert throws a `PostgrestError` with code `23505` and message `"duplicate key value violates unique constraint"` -- which does NOT contain the substring `"UNIQUE constraint failed"`. The catch block will miss it and the error will propagate as an unhandled 500 instead of a clean 409.
**Why it's bad:** The dual-DB contract is violated at the route layer. Anyone running with Supabase will get a 500 on duplicate provider creation instead of a 409. The route is silently SQLite-only.

### [BUG-2] Update "not found" detection works only on SQLite, broken on Supabase
**Severity: Major**
**File:** `backend/src/routes/providers/index.ts:113`
**What's wrong:** The PUT handler catches update errors by matching `err.message.includes('not found')`. The local `update()` throws `new Error('Provider ${id} not found')` which matches. The Supabase `update()` uses `.single()` which throws `PGRST116` with message `"JSON object requested, multiple (or no) rows returned"` -- which does NOT contain `"not found"`. Result: 500 instead of 404 on Supabase.
**Why it's bad:** Same as BUG-1 -- the route handler has an implicit SQLite-only assumption. The error translation is backend-specific but lives in the route layer, which is supposed to be backend-agnostic.

### [BUG-3] SQLite returns `enabled` as integer (0/1), not boolean
**Severity: Major**
**File:** `backend/src/db/local/providers.ts:16,20,27`
**What's wrong:** SQLite has no native boolean type. The `enabled` column is `INTEGER NOT NULL DEFAULT 1`. `better-sqlite3` returns raw integers, so `list()`, `getById()`, etc. return `{ enabled: 1 }` or `{ enabled: 0 }`, not `true`/`false`. The code does `as Provider[]` which lies to TypeScript -- the runtime value is still a number. The TypeBox response schema (`Type.Boolean()`) causes `fast-json-stringify` to serialize `1` as `true` (because of type coercion), so HTTP consumers see the correct value. But internally, any code that does strict comparison like `provider.enabled === true` will fail for SQLite-backed instances.
**Why it's bad:** A time-bomb. Today it works because `fast-json-stringify` coerces. Tomorrow, any service layer code or conditional logic using strict boolean comparison will silently break on SQLite but work on Supabase. The dual-DB abstraction leaks.

## Architectural violations

### [ARCH-1] Error translation belongs in the repository layer, not routes
**Severity: Major**
**File:** `backend/src/routes/providers/index.ts:33-37, 112-116`
**What's wrong:** The route handler knows about SQLite error message strings (`'UNIQUE constraint failed'`). Error interpretation for different DB backends is a repository concern. Each implementation should translate its own errors into a common application-level error (e.g., a custom `DuplicateKeyError` or a consistent error message). The route should only catch that common error.
**Why it's bad:** Every new route that handles duplicates or "not found on mutation" will have to repeat the same backend-specific string matching. If a third backend is added, every route needs updating. The route layer is supposed to be database-agnostic.

### [ARCH-2] Schema type duplication: TypeBox schemas vs db/types.ts
**Severity: Minor**
**File:** `backend/src/schemas/provider.ts` vs `backend/src/db/types.ts`
**What's wrong:** `Provider`, `CreateProvider`, `UpdateProvider`, and `ProviderType` are defined twice: once as TypeScript interfaces in `db/types.ts` (lines 1-20) and once as TypeBox schemas in `schemas/provider.ts` (lines 1-31). These are not derived from each other. If someone adds a field to one and forgets the other, the API response schema diverges from the DB type.
**Why it's bad:** Schema drift between the two definitions is inevitable over time. There is no compile-time check that ensures `Static<typeof Provider>` matches the `Provider` interface from `db/types.ts`.

## Project pattern violations

### [PAT-1] No validation on `key` field beyond presence
**Severity: Minor**
**File:** `backend/src/schemas/provider.ts:33-35`
**What's wrong:** `SetKeyBody` defines `key: Type.String()` with no constraints -- empty string `""` is accepted. An API key of `""` would be encrypted and stored, then returned as `""` via GET, silently corrupting the provider's auth configuration.
**Why it's bad:** Empty API keys are never valid. A `minLength: 1` constraint is the bare minimum.

### [PAT-2] Missing `additionalProperties: false` on input schemas
**Severity: Minor**
**File:** `backend/src/schemas/provider.ts:19-23, 26-30, 33-35`
**What's wrong:** `CreateProvider`, `UpdateProvider`, and `SetKeyBody` schemas don't have `{ additionalProperties: false }`. Fastify's Ajv validates against these schemas, but by default TypeBox objects allow additional properties to pass through. A client sending `{ id: "x", name: "X", type: "tts", admin: true }` will not be rejected -- the extra field silently passes validation.
**Why it's bad:** Defense-in-depth. Extra properties should be rejected at the API boundary to prevent unexpected data from reaching the DB layer.

## Testing violations

### [TEST-1] Tests only exercise SQLite backend
**Severity: Minor**
**File:** `backend/tests/routes/providers.test.ts`
**What's wrong:** All route tests use `buildTestApp()` which creates an in-memory SQLite database. There are no route-level tests exercising the Supabase backend. Given BUG-1 and BUG-2, this means the broken Supabase error paths are completely untested.
**Why it's bad:** The dual-DB guarantee is only as strong as its test coverage. Route tests against Supabase would have caught BUG-1 and BUG-2 immediately.

### [TEST-2] No test for empty body on PUT /providers/:id
**Severity: Minor**
**File:** `backend/tests/routes/providers.test.ts:112-143`
**What's wrong:** `UpdateProvider` has all optional fields. There's no test for `PUT /providers/:id` with `{}` as body. This is a valid edge case -- it should succeed and return the unchanged provider, but it's unverified.
**Why it's bad:** Edge cases are where bugs hide. The no-op update path (all fields undefined) exercises different code branches in both implementations.

## Summary

| Severity    | Count |
|-------------|-------|
| Fundamental | 0     |
| Major       | 4     |
| Minor       | 4     |

**Overall assessment:** The routes are clean, well-typed, and follow the project's Fastify patterns correctly. But the error handling is fundamentally SQLite-coupled -- the route layer hard-codes SQLite error strings, which completely breaks the dual-DB contract on Supabase. The `enabled` integer-vs-boolean mismatch is a latent bug hiding behind `fast-json-stringify` coercion. These are not cosmetic issues; they are structural problems in the DB abstraction boundary.
