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
| TTS | Google, ElevenLabs, Inworld, OpenAI, Gemini |
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

## Configuring Providers

Sound Lab requires API keys for each provider you want to use. Go to the **Providers** page in the UI to enter your keys. Below are instructions for obtaining a key from each service.

### ElevenLabs

Used by: **ElevenLabs** (TTS), **ElevenLabs Realtime**

1. Sign up at [elevenlabs.io](https://elevenlabs.io/).
2. Go to your profile → **API Keys** (or visit [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)).
3. Click **Create API Key**, give it a name, and copy the key.
4. Paste the key into the **ElevenLabs** provider in Sound Lab. The same key is used for both TTS and Realtime.

> Free tier includes a limited number of characters per month. Paid plans unlock more voices, higher quotas, and lower latency.

### Google Cloud TTS

Used by: **Google** (TTS)

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Cloud Text-to-Speech API** for your project ([direct link](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)).
3. Go to **IAM & Admin → Service Accounts** and create a new service account.
4. On the service account page, go to the **Keys** tab → **Add Key → Create new key → JSON**.
5. A `.json` file will be downloaded. Open it and copy **the entire contents**.
6. Paste the full JSON string as the API key in Sound Lab.

> Google Cloud offers a free tier of 1 million characters/month for standard voices and 1 million characters/month for WaveNet voices. You need to set up a billing account even for the free tier.

### Inworld

Used by: **Inworld** (TTS), **Inworld Realtime**

1. Sign up at [studio.inworld.ai](https://studio.inworld.ai/).
2. Navigate to **Settings → API Keys** (or your workspace's integrations page).
3. Create a new API key. Copy the key value.
4. Paste it into the **Inworld** provider in Sound Lab. The same key is used for both TTS and Realtime.

### OpenAI

Used by: **OpenAI TTS**, **OpenAI Realtime**, **OpenAI** (LLM)

1. Sign up at [platform.openai.com](https://platform.openai.com/).
2. Go to **API Keys** at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Click **Create new secret key**, name it, and copy the key (starts with `sk-`).
4. Paste the key into the **OpenAI TTS** provider (and/or **OpenAI Realtime**, **OpenAI** LLM) in Sound Lab.

> OpenAI API is pay-as-you-go. TTS pricing depends on the model (`tts-1` is cheaper, `tts-1-hd` higher quality, `gpt-4o-mini-tts` supports instructions). You need to add a payment method and purchase credits.

### Anthropic

Used by: **Anthropic** (LLM)

1. Sign up at [console.anthropic.com](https://console.anthropic.com/).
2. Go to **API Keys** at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys).
3. Click **Create Key**, name it, and copy the key (starts with `sk-ant-`).
4. Paste the key into the **Anthropic** provider in Sound Lab.

> Anthropic API is pay-as-you-go. You need to add a payment method and purchase credits.

### Google Gemini

Used by: **Gemini TTS**, **Gemini Realtime**

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key** → **Create API key** (or visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
3. Select or create a Google Cloud project, then copy the generated key.
4. Paste the key into the **Gemini TTS** and/or **Gemini Realtime** provider in Sound Lab.

> The Gemini API offers a free tier with rate limits. Paid usage requires a billing account linked to the Google Cloud project.

## Documentation

- [Architecture](docs/architecture.md) -- system design, database schema, provider interfaces
- [UI/UX](docs/ui.md) -- page layouts and user flows

## License

[MIT](LICENSE)
