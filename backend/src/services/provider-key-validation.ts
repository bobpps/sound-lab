import type { Provider } from '../db/types.js';
import type { LLMProviderFactory } from '../plugins/llm.js';
import type { RealtimeProviderFactory } from '../plugins/realtime.js';
import type { TTSProviderFactory } from '../plugins/tts.js';
import type {
  ProviderKeyTestResponse,
  ProviderKeyTestStatus,
} from '../schemas/provider.js';

const KEY_TEST_MESSAGES: Record<ProviderKeyTestStatus, string> = {
  valid: 'Saved API key is active.',
  invalid: 'The saved API key was rejected or lacks required access.',
  not_configured: 'Add an API key before testing this provider.',
  unsupported: 'This provider does not support key validation yet.',
  error: 'Unable to verify the key right now. Try again later.',
};

export interface ProviderKeyValidationDeps {
  createTTSProvider: TTSProviderFactory;
  createLLMProvider: LLMProviderFactory;
  createRealtimeProvider: RealtimeProviderFactory;
  onValidationError?: (event: {
    providerId: string;
    providerType: Provider['type'];
    status: 'invalid' | 'error';
  }) => void;
}

export function createKeyTestResponse(
  providerId: string,
  status: ProviderKeyTestStatus,
): ProviderKeyTestResponse {
  return {
    provider_id: providerId,
    status,
    message: KEY_TEST_MESSAGES[status],
    checked_at: new Date().toISOString(),
  };
}

function isCredentialFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return [
    '401',
    '403',
    'unauthorized',
    'forbidden',
    'apikey',
    'invalid api key',
    'invalid key',
    'invalid credentials',
    'authentication',
    'permission',
    'quota',
    'expired',
    'rejected',
  ].some((needle) => normalized.includes(needle));
}

function isUnsupportedProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unsupported .*provider/i.test(message);
}

function classifyValidationError(
  provider: Provider,
  error: unknown,
  deps: ProviderKeyValidationDeps,
): ProviderKeyTestResponse {
  const status = isCredentialFailure(error) ? 'invalid' : 'error';
  deps.onValidationError?.({
    providerId: provider.id,
    providerType: provider.type,
    status,
  });
  return createKeyTestResponse(provider.id, status);
}

async function testTTSProvider(
  provider: Provider,
  apiKey: string,
  deps: ProviderKeyValidationDeps,
): Promise<ProviderKeyTestResponse> {
  let ttsProvider;
  try {
    ttsProvider = deps.createTTSProvider(provider.id, apiKey);
  } catch (error) {
    return isUnsupportedProviderError(error)
      ? createKeyTestResponse(provider.id, 'unsupported')
      : classifyValidationError(provider, error, deps);
  }

  try {
    const isValid = await ttsProvider.validateCredentials();
    return createKeyTestResponse(provider.id, isValid ? 'valid' : 'invalid');
  } catch (error) {
    return classifyValidationError(provider, error, deps);
  }
}

async function testLLMProvider(
  provider: Provider,
  apiKey: string,
  deps: ProviderKeyValidationDeps,
): Promise<ProviderKeyTestResponse> {
  let llmProvider;
  try {
    llmProvider = deps.createLLMProvider(provider.id, apiKey);
  } catch (error) {
    return isUnsupportedProviderError(error)
      ? createKeyTestResponse(provider.id, 'unsupported')
      : classifyValidationError(provider, error, deps);
  }

  try {
    const isValid = await llmProvider.validateCredentials();
    return createKeyTestResponse(provider.id, isValid ? 'valid' : 'invalid');
  } catch (error) {
    return classifyValidationError(provider, error, deps);
  }
}

async function testRealtimeProvider(
  provider: Provider,
  apiKey: string,
  deps: ProviderKeyValidationDeps,
): Promise<ProviderKeyTestResponse> {
  let realtimeProvider;
  try {
    realtimeProvider = deps.createRealtimeProvider(provider.id, apiKey);
  } catch (error) {
    return isUnsupportedProviderError(error)
      ? createKeyTestResponse(provider.id, 'unsupported')
      : classifyValidationError(provider, error, deps);
  }

  try {
    await realtimeProvider.getModels();
    return createKeyTestResponse(provider.id, 'valid');
  } catch (error) {
    return classifyValidationError(provider, error, deps);
  }
}

export async function testProviderKey(
  provider: Provider,
  apiKey: string,
  deps: ProviderKeyValidationDeps,
): Promise<ProviderKeyTestResponse> {
  if (provider.type === 'tts') {
    return testTTSProvider(provider, apiKey, deps);
  }

  if (provider.type === 'llm') {
    return testLLMProvider(provider, apiKey, deps);
  }

  return testRealtimeProvider(provider, apiKey, deps);
}
