# UI / UX

## Layout

Classic admin panel layout:
- Fixed left sidebar with navigation
- Top header with username and logout button
- Right content area

## Navigation (Sidebar)

- Datasets
- TTS Testing
- Realtime
- Providers

---

## Datasets

Two tabs: **Dialogs** and **Prompts**.

### Dialogs tab

List of dialogs. Each item shows: title, language, creation date, author.

Click → opens dialog editor on a separate page.

**Dialog editor page:**
- Edit metadata: title, description, language
- Add / edit / delete dialog lines (character 1 or 2, text)
- **Generate** button — generate a new dialog via LLM
- **Edit with LLM** button — edit current dialog via a prompt
- Both LLM actions include a dropdown to select LLM provider and model

### Prompts tab

List of annotation prompts. Each item shows: title, language, TTS provider, creation date, author.

Click → opens prompt editor on a separate page.

**Prompt editor page:**
- Edit fields: title, language, TTS provider
- Text area for the prompt body

---

## TTS Testing

Single page with a sequential flow:

1. Select TTS provider → model (model settings load dynamically)
2. Select dialog
3. Select annotation variant from dropdown (or use clean dialog without annotation)
4. Annotation editor — inline on this page:
   - Edit annotation text directly
   - Save as new annotation variant
   - Run auto-annotation via LLM (select LLM provider + model + annotation prompt)
5. Assign a voice to each character (voices loaded from selected provider)
6. **Run** button → plays dialog line by line
   - Current line is highlighted in the annotation editor during playback

---

## Realtime

Tabs for each provider: **OpenAI**, **Gemini**, **ElevenLabs**, **Inworld**.

Each tab is an isolated page with its own connection logic.

**Flow per tab:**
1. Select model
2. Select existing agent prompt or create one inline (with option to save)
3. **Start** button → begins realtime session
   - Microphone is always active
   - Live transcription shown (user lines + agent responses)
   - **Stop** button ends the session

---

## Providers

Three tabs: **TTS**, **LLM**, **Realtime**.

Each tab shows a list of providers for that type. Per provider:
- Name
- API key field (encrypted at rest)
- Enable / disable toggle
