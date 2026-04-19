# Analysis

## Requirements

- Fix provider key validation requests that fail with Fastify
  `FST_ERR_CTP_EMPTY_JSON_BODY`.
- Preserve JSON `Content-Type` for POST and PUT requests that actually include a
  JSON request body.
- Add regression coverage for the no-body provider key test request shape.

## Root Cause

`frontend/src/lib/api-client.ts` always includes `Content-Type:
application/json` for `api.post()` and `api.put()`. When `api.post()` is called
without a body by `testProviderKey()`, fetch sends a POST with JSON content type
and no body. Fastify rejects that before the route handler runs.

The backend `POST /providers/:id/key/test` route has no body schema and existing
route tests already call it without a payload successfully, so the backend route
is not the root cause.

## Involved Systems

- Shared frontend API client: `frontend/src/lib/api-client.ts`
- Provider query helper: `frontend/src/features/providers/api/queries.ts`
- Provider UI tests: `frontend/src/features/providers/components/ProvidersPage.test.tsx`
- Backend provider route tests for context only:
  `backend/tests/routes/providers.test.ts`

## Constraints

- Follow frontend feature boundaries; shared API client remains in
  `frontend/src/lib`.
- Keep relative TypeScript imports with `.ts` extensions in frontend tests, as
  existing tests do.
- TDD is practical because the request shape can be asserted with a fetch mock.

## Risks

- Removing `Content-Type` from bodyless POST/PUT calls must not affect JSON calls
  that pass an explicit body.
- Tests that assert fetch options should remain stable while avoiding overly
  broad coupling to header object identity.

## Assumptions

- `undefined` means no request body. Explicit `null`, `{}`, arrays, strings, or
  other values are still intentional JSON bodies and should keep JSON headers.
