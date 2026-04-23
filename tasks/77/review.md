# Review

## Changed Files

- `frontend/src/lib/api-client.ts`: adds shared JSON header construction and
  sends `Content-Type: application/json` only when POST/PUT receives a defined
  body.
- `frontend/src/lib/api-client.test.ts`: adds regression coverage for bodyless
  POST, bodyful POST, and bodyless PUT request shapes.

## Behavioral Summary

Bodyless `api.post()` calls, including `testProviderKey()`, now keep
`Accept: application/json` but omit `Content-Type: application/json`, preventing
Fastify from treating the request as an empty JSON payload. Bodyful JSON POST
and PUT calls still serialize the body and keep JSON content type.

## Verification

- `npm run test --workspace=frontend -- api-client`: passed.
- `npm run build`: passed.
- `npm test`: passed.
- `npm run lint --workspace=frontend`: passed.

Known unrelated test output: the full frontend suite still prints a React
`act(...)` warning from `AnnotationEditor.test.tsx`.

## Findings

- Minor: none.
- Major: none.
- Fundamental: none.

## PR Readiness

Ready. Review, alignment, and code-critic gates are clean.
