# Task 28 Analysis: TTS Testing -- Voice Assignment + Audio Playback

## What the Task Requires

Build three new components/hooks and wire them into the TTS page:

1. **VoiceAssignment** -- two voice dropdown selectors (one per dialog character), populated from the TTS provider voice list
2. **useAudioPlayback** -- a custom hook managing sequential line-by-line audio playback: synthesize each message via the backend API, play via HTMLAudioElement, track current index, support stop/abort
3. **PlaybackControls** -- UI with Run/Stop buttons and a progress indicator showing which line is playing
4. **Wire into TtsPage** -- place VoiceAssignment after the annotation editor section, PlaybackControls at the bottom, and pass currentMessageIndex to AnnotationEditor for line highlighting

## Current State of the TTS Feature

### What Exists

- **`frontend/src/pages/TtsPage.tsx`** -- a stub placeholder component with just a title and description. No real functionality.
- **Backend TTS routes** (`backend/src/routes/tts/index.ts`) -- fully implemented:
  - `GET /tts/:providerId/voices` -- returns `Voice[]`
  - `POST /tts/:providerId/synthesize` -- returns raw audio binary (mp3/wav/ogg etc.)
- **Backend TTS providers** -- ElevenLabs, Google, Inworld implementations all complete
- **Frontend API types** (`frontend/src/types/api.ts`) -- `Voice` interface already defined
- **Frontend API client** (`frontend/src/lib/api-client.ts`) -- typed fetch wrapper with `get`, `post`, `fetchRaw` methods

### What Does NOT Exist (needs to be created)

- **`frontend/src/features/tts/`** directory -- the entire feature directory is missing. No `api/`, `components/`, `hooks/`, or `types/` subdirs.
- **`useTtsVoices` hook** -- does NOT exist. Referenced in issue but needs to be created as a TanStack Query hook.
- **TtsPage as feature component** -- the stub at `pages/TtsPage.tsx` needs to be replaced with a proper feature component at `features/tts/components/TtsPage.tsx`.
- **ProviderSelector, DialogSelector, AnnotationSelector, AnnotationEditor** -- all part of Tasks 25-27 (#25, #26, #27), none of which exist yet. These are all upstream dependencies.

### What Exists in Other Features (patterns to follow)

- **`features/datasets/api/queries.ts`** -- established pattern for TanStack Query hooks: query key factories, `useQuery` with `queryKey`/`queryFn`, `useMutation` with `onSuccess` invalidation
- **`features/providers/api/queries.ts`** -- simpler query hook pattern with `useProviders(type)`
- **Component patterns**: cards with rounded-2xl borders, gray-900 primary buttons, error states with red-200 borders, loading states with dashed borders

## API Contracts

### GET /tts/:providerId/voices

- **URL (from frontend):** `/api/tts/<providerId>/voices` (Vite proxy strips `/api`, routes to `localhost:3000/tts/<providerId>/voices`)
- **Params:** `providerId: string` (e.g., "elevenlabs", "google", "inworld")
- **Response 200:** `Voice[]`

```typescript
interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  description?: string;
  previewUrl?: string;
  providerMeta?: Record<string, unknown>;
}
```

- **Response 400:** `{ statusCode, error, message }` -- no API key configured
- **Response 404:** `{ statusCode, error, message }` -- provider not found or not TTS type

### POST /tts/:providerId/synthesize

- **URL (from frontend):** `/api/tts/<providerId>/synthesize`
- **Params:** `providerId: string`
- **Body:**

```typescript
interface SynthesizeBody {
  voiceId: string;
  text: string;          // minLength: 1
  speed?: number;
  temperature?: number;
  format?: string;        // "mp3", "wav", "ogg", "flac", "pcm", "linear16", "ogg_opus"
  sampleRate?: number;
}
```

- **Response 200:** Raw audio binary (`audio/mpeg`, `audio/wav`, etc. based on format)
- **Response 400/404:** Error response

**Critical note for frontend:** The synthesize endpoint returns binary audio data, NOT JSON. The `api.post()` method always calls `response.json()`, so we must NOT use it. Instead, use `api.fetchRaw()` to get the raw `Response`, then create an audio blob/URL from it.

## Data Model Understanding

### Dialogs and Characters

- A **Dialog** has an `id`, `title`, `description`, `language`, and metadata fields
- A Dialog contains **DialogMessages**, each with:
  - `character: 1 | 2` -- there are exactly two characters per dialog
  - `text: string` -- the line text
  - `order: number` -- determines sequencing
- Characters are identified by number (1 or 2), not by name. The UI needs to let users assign a voice to "Character 1" and "Character 2".

### Annotations

- An **AnnotatedDialog** is a variant of a Dialog, tied to a `provider_id` (TTS provider)
- It contains **AnnotatedMessages**, each linked to a `dialog_message_id` with a potentially modified `text`
- The annotation provides alternative text for TTS synthesis (e.g., phonetic corrections, emphasis markers)
- When playing back, the text to synthesize comes from the annotated message (if annotation selected) or the original dialog message (if "Clean/no annotation")

### Playback Flow

For each message in order:
1. Determine which character (1 or 2) speaks
2. Look up the voice assigned to that character
3. Get the text (from annotation if selected, otherwise from original message)
4. POST to `/tts/:providerId/synthesize` with `{ voiceId, text }`
5. Receive audio binary, create blob URL, play via Audio element
6. When audio ends, advance to next message
7. Update `currentMessageIndex` for UI highlighting

## Key Files and Systems Involved

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/features/tts/api/queries.ts` | TanStack Query hooks: `useTtsVoices(providerId)` |
| `frontend/src/features/tts/components/VoiceAssignment.tsx` | Two dropdowns for character voice selection |
| `frontend/src/features/tts/components/PlaybackControls.tsx` | Run/Stop buttons + progress indicator |
| `frontend/src/features/tts/hooks/useAudioPlayback.ts` | Core playback logic hook |
| `frontend/src/features/tts/components/TtsPage.tsx` | Full TTS page (replaces stub) |

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/router.tsx` | Update import path from `pages/TtsPage.tsx` to `features/tts/components/TtsPage.tsx` |

### Reference Files (read-only)

| File | Why |
|------|-----|
| `backend/src/routes/tts/index.ts` | API contract |
| `backend/src/schemas/tts.ts` | Request/response TypeBox schemas |
| `frontend/src/lib/api-client.ts` | Fetch wrapper, especially `fetchRaw()` for binary |
| `frontend/src/types/api.ts` | `Voice` type already defined |
| `frontend/src/features/datasets/api/queries.ts` | Pattern for query hooks |
| `frontend/src/features/providers/` | Pattern for feature structure |

## Constraints from Project Guidance

1. **Feature-based structure** -- everything under `features/tts/` with `api/`, `components/`, `hooks/` subdirs
2. **No cross-feature imports** -- cannot import from `features/datasets/` or `features/providers/`
3. **No barrel files** -- import each file directly
4. **React Compiler active** -- do NOT use `useMemo`/`useCallback`/`React.memo`
5. **TanStack Query** for server state (voice list fetching)
6. **Tailwind CSS** for styling -- follow existing patterns (rounded-2xl cards, gray-900 buttons, etc.)
7. **ESM everywhere** -- `.ts` extensions in imports
8. **Vitest + React Testing Library + MSW** for testing
9. **`forwardRef` deprecated** -- use `ref` as regular prop
10. **TDD by default** -- write tests first, then implement

## Risks and Assumptions

### Risks

1. **Dependency on #27 (AnnotationEditor) -- OPEN**
   - The TtsPage is supposed to pass `currentMessageIndex` to AnnotationEditor for highlighting
   - AnnotationEditor does NOT exist yet (Task 26/Issue #27 is OPEN)
   - **Mitigation:** Build VoiceAssignment and PlaybackControls independently. Wire them into a TtsPage that has placeholder slots for the AnnotationEditor. When #27 is implemented, it adds the AnnotationEditor and integrates `currentMessageIndex`.

2. **Dependency on #25 (ProviderSelector, DialogSelector, AnnotationSelector) -- status unknown**
   - The full TTS page flow requires these selector components
   - None of these exist yet
   - **Mitigation:** Task 28 can build VoiceAssignment + PlaybackControls + useAudioPlayback as standalone components/hooks. The TtsPage wiring may need to be minimal or include basic selector stubs.

3. **Audio playback in browser**
   - The `HTMLAudioElement` cannot play from an `ArrayBuffer` directly. Need to create a `Blob` URL.
   - Need to handle browser autoplay policies (user gesture required for first play)
   - Need to clean up blob URLs to avoid memory leaks
   - AbortController needed for cancellation of in-flight fetch requests

4. **Binary response handling**
   - The `api.post()` method assumes JSON responses. The synthesize endpoint returns binary audio.
   - Must use `api.fetchRaw()` and handle the response manually.

### Assumptions

1. The synthesize endpoint default format is mp3 (`audio/mpeg`), which all modern browsers can play
2. Characters are always 1 and 2 -- no multi-character dialogs beyond two participants
3. Voice assignment is local state (not persisted) -- user picks voices per session
4. Audio playback is sequential (one line at a time), not concurrent
5. The user will have already selected a TTS provider before reaching the voice assignment step

## Unknowns Resolved

| Unknown | Resolution |
|---------|------------|
| Does `useTtsVoices` exist? | NO -- needs to be created in `features/tts/api/queries.ts` |
| How does the synthesize API return audio? | Raw binary with content-type header. Use `fetchRaw()` + `response.blob()` |
| What are "characters"? | `character: 1 \| 2` field on DialogMessage. Two participants per dialog. |
| Where does TtsPage live? | Currently `pages/TtsPage.tsx` (stub). Will be replaced by `features/tts/components/TtsPage.tsx`. |
| How does `api-client.ts` handle binary? | `fetchRaw(path, opts)` returns raw `Response`. No JSON parsing. |
| Does Vite proxy strip `/api`? | YES -- rewrites path. Frontend calls `/api/tts/...`, backend receives `/tts/...`. |

## Dependency Status

### Issue #27 (AnnotationEditor + auto-annotation) -- OPEN

**What #27 creates:**
- `AnnotationEditor.tsx` -- shows dialog messages with original + annotated text, editable
- Query hooks: `useAutoAnnotate()`, `useCreateAnnotation()`, `useUpdateAnnotatedMessage()`
- Modified TtsPage with annotation editor section

**What Task 28 needs from #27:**
- AnnotationEditor component with a `highlightedIndex?: number` prop (or similar) for line highlighting during playback
- The message list from AnnotationEditor to know what text to synthesize

**Impact on Task 28:**
- VoiceAssignment and PlaybackControls are independent of AnnotationEditor
- `useAudioPlayback` needs the message list (text + character) but this comes from the dialog/annotation data, not from AnnotationEditor directly
- The `currentMessageIndex` highlighting is a prop that goes TO AnnotationEditor -- if it doesn't exist, it doesn't block the hook or controls
- **Decision:** Build everything except the highlighting integration. The TtsPage can be structured to accept AnnotationEditor when it's ready.

### Issue #12 (TTS API routes) -- CLOSED

Backend is fully ready. Both `GET /voices` and `POST /synthesize` are implemented and tested.

### Issues #25/#26 (ProviderSelector, DialogSelector, AnnotationSelector) -- OPEN

These selectors don't exist yet. Task 28's components are downstream of them but can be built independently. The TtsPage orchestration may need to include basic selector functionality or stubs.

## Component Interface Sketches

### useTtsVoices (query hook)

```typescript
// features/tts/api/queries.ts
function useTtsVoices(providerId: string | null) {
  return useQuery({
    queryKey: ["tts", "voices", providerId],
    queryFn: () => api.get<Voice[]>("/tts/" + providerId + "/voices"),
    enabled: providerId !== null,
  });
}
```

### VoiceAssignment

```typescript
interface VoiceAssignmentProps {
  providerId: string;
  voices: Voice[];
  isLoading: boolean;
  voiceChar1: string | null;
  voiceChar2: string | null;
  onVoiceChange: (character: 1 | 2, voiceId: string) => void;
  disabled?: boolean;
}
```

### useAudioPlayback

```typescript
interface UseAudioPlaybackOptions {
  providerId: string;
  messages: Array<{ text: string; character: 1 | 2 }>;
  voiceMap: Record<1 | 2, string | null>;  // character -> voiceId
}

interface UseAudioPlaybackResult {
  currentMessageIndex: number | null;
  isPlaying: boolean;
  play: () => void;
  stop: () => void;
}
```

### PlaybackControls

```typescript
interface PlaybackControlsProps {
  isPlaying: boolean;
  currentIndex: number | null;
  totalMessages: number;
  canPlay: boolean;  // false if voices not assigned or no messages
  onPlay: () => void;
  onStop: () => void;
}
```

## Audio Playback Implementation Strategy

1. **Synthesize function:** Use `api.fetchRaw()` to POST to synthesize endpoint, get binary response
2. **Blob URL:** Create `URL.createObjectURL(await response.blob())` for each audio chunk
3. **HTMLAudioElement:** Create `new Audio(blobUrl)`, listen for `ended` event, advance to next
4. **AbortController:** Create one per playback session. On `stop()`, abort the controller to cancel in-flight requests
5. **Cleanup:** Revoke blob URLs after playback to prevent memory leaks
6. **Error handling:** If synthesis fails for a line, stop playback and report error
