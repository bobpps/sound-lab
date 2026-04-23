import type { ApiErrorResponse } from '../types/api.ts';

const BASE_URL = '/api';

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body: ApiErrorResponse = await response.json();
      message = body.message || message;
    } catch {
      // Response body wasn't JSON — keep statusText
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

function buildUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

function buildJsonHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = { 'Accept': 'application/json' };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(buildUrl(path), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: buildJsonHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const hasBody = body !== undefined;
    const response = await fetch(buildUrl(path), {
      method: 'PUT',
      headers: buildJsonHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete(path: string): Promise<void> {
    const response = await fetch(buildUrl(path), {
      method: 'DELETE',
    });
    await handleResponse<void>(response);
  },

  async fetchRaw(path: string, opts?: RequestInit): Promise<Response> {
    return fetch(buildUrl(path), opts);
  },
};
