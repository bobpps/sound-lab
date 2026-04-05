# Task Context — Issue #10

- **Issue:** #10 — Task 9: Google TTS adapter
- **URL:** https://github.com/bobpps/sound-lab/issues/10
- **Branch:** `feat/10-google-tts`
- **Worktree:** `.claude/worktrees/feat/10-google-tts`
- **Labels:** backend, providers
- **Depends on:** #9 (closed, merged to main)

## Issue Description

Implement Google Cloud Text-to-Speech adapter following the `ITTSProvider` interface established in issue #9.

**Files to create:**
- `backend/src/providers/tts/google.ts`
- `backend/tests/providers/google-tts.test.ts`

**Files to modify:**
- `backend/src/providers/tts/registry.ts` (add google entry)

**Steps from issue:**
1. Install `@google-cloud/text-to-speech`
2. Write tests — mock Google client, test getVoices(), synthesize(), validateCredentials()
3. Run tests — fail (RED)
4. Implement `GoogleTTSProvider` — map Google voice format to IVoice, synthesize returns Buffer
5. Add to registry
6. Run tests — pass (GREEN)
7. Commit

## Key Interfaces

```typescript
interface ITTSProvider {
  readonly id: string;
  readonly name: string;
  getVoices(): Promise<IVoice[]>;
  synthesize(opts: ISynthesizeOptions): Promise<Buffer>;
  validateCredentials(): Promise<boolean>;
}
```

## Relevant Files

- `backend/src/providers/tts/types.ts` — IVoice, ISynthesizeOptions, ITTSProvider
- `backend/src/providers/tts/registry.ts` — provider factory + listing
- `backend/src/providers/tts/elevenlabs.ts` — reference implementation
- `backend/tests/providers/elevenlabs.test.ts` — reference test patterns
- `backend/tests/providers/registry.test.ts` — registry tests to update
- `backend/CLAUDE.md` — backend conventions
- `CLAUDE.md` — project-level guidance
