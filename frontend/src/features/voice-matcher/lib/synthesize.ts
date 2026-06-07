import { ApiError, api } from "../../../lib/api-client.ts";
import {
  CANDIDATE_PROVIDER_ID,
  REFERENCE_PROVIDER_ID,
} from "../api/queries.ts";

async function postSynthesize(
  providerId: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await api.fetchRaw(`/tts/${providerId}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch {
      // non-JSON error body — keep statusText
    }
    throw new ApiError(response.status, message);
  }

  return response.blob();
}

export function synthesizeReference(
  voiceId: string,
  text: string,
  model: string,
  signal: AbortSignal,
): Promise<Blob> {
  // Gemini defaults to WAV — do NOT send a format.
  return postSynthesize(
    REFERENCE_PROVIDER_ID,
    { voiceId, text, model },
    signal,
  );
}

export function synthesizeCandidate(
  voiceId: string,
  text: string,
  signal: AbortSignal,
): Promise<Blob> {
  // LINEAR16 -> the route maps it to audio/wav for a fair A/B with the WAV reference.
  return postSynthesize(
    CANDIDATE_PROVIDER_ID,
    { voiceId, text, format: "LINEAR16" },
    signal,
  );
}
