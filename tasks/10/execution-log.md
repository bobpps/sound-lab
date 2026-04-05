# Execution Log — Issue #10: Google TTS Adapter

## Execution Method
Subagent-driven development with two-stage review per task group.

## Task Groups
Tasks 1-3 grouped (install + tests + skeleton) — sequential TDD dependency.
Tasks 4-5 grouped (getVoices tests + implementation) — sequential TDD dependency.
Tasks 6-7 grouped (synthesize tests + implementation) — sequential TDD dependency.
Task 8: Registry update (independent).
Task 9: Final verification.

## Log

### Started
- Timestamp: 2026-04-05
- Branch: feat/10-google-tts
- Base commit: 77f4ecb

### Tasks 1-5 (Subagent)
- Installed `@google-cloud/text-to-speech` dependency
- Created test file with identity, constructor, validateCredentials tests (RED)
- Implemented GoogleTTSProvider skeleton with parseCredentials, validateCredentials (GREEN)
- Added getVoices tests including numeric ssmlGender handling (RED)
- Implemented getVoices with GENDER_MAP and resolveGender helper (GREEN)
- Commits: 348cee3, 07c67bd, 3aa587f, a4990ca

### Tasks 6-7 (Direct)
- Added 9 synthesize tests: Buffer return, request defaults, languageCode extraction, speed mapping, format mapping, sampleRate inclusion/exclusion, API error
- Implemented synthesize with extractLanguageCode helper, audioConfig construction, conditional sampleRateHertz
- Commit: e272105

### Task 8 (Direct)
- Updated registry.ts to import and register GoogleTTSProvider under key "google"
- Updated registry tests: added Google creation test, updated getSupportedTTSProviders assertion
- Commit: 08be02f

### Task 9: Verification
- Build: clean (backend tsc + frontend vite)
- Tests: 175/175 passed across 14 test files
- Lint: clean (frontend eslint)

### Decisions
1. **Credentials as JSON string**: apiKey parameter contains JSON-serialized Google service account credentials. parseCredentials validates structure before passing to TextToSpeechClient.
2. **Gender mapping dual-mode**: Google API may return ssmlGender as string ("MALE") or number (1). resolveGender handles both.
3. **Language code extraction**: Split voiceId on "-" and take first two parts (e.g. "en-US-Wavenet-A" → "en-US").
4. **No temperature mapping**: Google TTS doesn't support temperature. ISynthesizeOptions.temperature is silently ignored.
5. **Conditional sampleRate**: Only include sampleRateHertz in audioConfig when explicitly provided, to allow Google API defaults.
