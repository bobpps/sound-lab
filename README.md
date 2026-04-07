# Sound Lab

Internal tool for testing TTS providers, realtime voice agents, and managing dialog datasets.

## Features

- **Datasets** -- create and manage test dialogs, generate/edit via LLM, annotate with SSML
- **TTS Testing** -- synthesize dialogs with Google, ElevenLabs, Inworld; compare voices and annotation variants
- **Realtime Agents** -- test voice agents via OpenAI, Gemini, ElevenLabs, Inworld with live transcription
- **Provider Management** -- configure API keys and enable/disable providers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript |
| Backend | Fastify 5, TypeScript |
| Database | Supabase (Postgres) or SQLite (local dev) |
| TTS | Google, ElevenLabs, Inworld, Gemini |
| LLM | OpenAI, Anthropic |
| Auth | Supabase Auth (production) / single-user (local) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Running in Development

```bash
npm run dev
```

This starts both backend (port 3000) and frontend (port 5173) concurrently.

### Database

By default, the backend uses a **local SQLite database** (`./data/sound-lab.db`) -- no external services needed.

To use **Supabase** instead, create `backend/.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
ENCRYPTION_KEY=your-encryption-key
```

Run the migration from `backend/src/db/supabase/migrations/001_initial.sql` in the Supabase SQL editor.

See `backend/.env.example` for all available environment variables.

### Running Tests

```bash
npm run test --workspace=backend
```

## Project Structure

```
sound-lab/
  backend/          Fastify API server
    src/
      db/           Database abstraction layer (repository pattern)
        local/      SQLite implementation (better-sqlite3)
        supabase/   Supabase implementation (sound_lab schema)
      routes/       API endpoints
      providers/    TTS and LLM provider adapters
      services/     Business logic
    tests/
  frontend/         React SPA
    src/
      pages/        Datasets, TTS, Realtime, Providers
      components/
      hooks/
      api/
  docs/             Architecture and UI documentation
```

## Configuring Gemini TTS

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** → **Create API key** (or visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
3. Select or create a Google Cloud project, then copy the generated key.
4. Paste the key into the **Gemini TTS** provider on the Providers page.

> The Gemini API offers a free tier with rate limits. Paid usage requires a billing account linked to the Google Cloud project.

## Documentation

- [Architecture](docs/architecture.md) -- system design, database schema, provider interfaces
- [UI/UX](docs/ui.md) -- page layouts and user flows

## License

[MIT](LICENSE)
