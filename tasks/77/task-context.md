# Issue 77 Task Context

- Issue: #77, "Provider key test requests fail with empty JSON body 400"
- URL: https://github.com/bobpps/sound-lab/issues/77
- Branch: `feat/77-provider-key-test`
- Worktree: `f:\InterviewProj\sources\sound-lab\.agents\worktrees\feat\77-provider-key-test`
- Labels: bug, frontend, providers
- Assignees: none
- State: open

## Summary

After #76, `POST /providers/:id/key/test` fails before provider validation
because the frontend `api.post()` helper sends `Content-Type:
application/json` even when no request body is provided. Fastify rejects that
empty JSON request with `FST_ERR_CTP_EMPTY_JSON_BODY`.

## Expected Behavior

Provider key test requests from the Providers page should reach the backend
route handler and return a `ProviderKeyTestResponse`.

## Comments

No issue comments at task start.

## Likely Areas

- `frontend/src/lib/api-client.ts`
- Provider feature API hooks and tests
- Backend provider route tests only if frontend request shape cannot be covered
  directly
