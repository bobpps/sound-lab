# Plan

## Goal

Make provider key test requests reach the backend route by ensuring bodyless
frontend POST requests do not advertise an empty JSON body.

## Scope

- Update `frontend/src/lib/api-client.ts`.
- Add regression tests in `frontend/src/lib/api-client.test.ts`.
- Do not change backend route behavior unless tests reveal a separate backend
  issue.

## Tasks

1. Add API client tests for:
   - `post()` with no body sends no `Content-Type` and no body.
   - `post()` with a body still sends JSON headers and serialized body.
   - `put()` with no body follows the same no-body header rule.
2. Update API client header construction for POST and PUT to include
   `Content-Type: application/json` only when `body !== undefined`.
3. Run focused frontend test(s).
4. Run full verification:
   - `npm run build`
   - `npm test`
   - `npm run lint --workspace=frontend`
5. Review diff, perform alignment check, run code-critic, then finalize with
   commit, push, PR, and human review gate.

## Rollback

If the shared helper change breaks existing bodyful calls, revert the helper
change and add an explicit `postWithoutBody()` helper. Prefer the shared fix
unless verification shows incompatibility.
