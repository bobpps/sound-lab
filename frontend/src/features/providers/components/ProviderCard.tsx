import { useState } from "react";
import { ApiError } from "../../../lib/api-client.ts";
import type { Provider, ProviderKeyTestResponse } from "../../../types/api.ts";
import { useProviderKeyTest, useSetProviderKey, useUpdateProvider } from "../api/queries.ts";
import { ApiKeyDialog } from "./ApiKeyDialog.tsx";

interface ProviderCardProps {
  provider: Provider;
}

type KeyStatusTone = "neutral" | "checking" | "valid" | "invalid" | "error";

interface KeyStatusView {
  label: string;
  message: string;
  tone: KeyStatusTone;
}

const KEY_STATUS_STYLES: Record<KeyStatusTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  checking: "bg-amber-100 text-amber-800",
  valid: "bg-green-100 text-green-800",
  invalid: "bg-red-100 text-red-800",
  error: "bg-slate-100 text-slate-700",
};

function resolveKeyStatus(
  hasConfiguredKey: boolean,
  isChecking: boolean,
  response: ProviderKeyTestResponse | undefined,
  error: unknown,
): KeyStatusView {
  if (!hasConfiguredKey) {
    return {
      label: "Not configured",
      message: "Add a key to test it.",
      tone: "neutral",
    };
  }

  if (isChecking) {
    return {
      label: "Checking...",
      message: "Validating the saved key.",
      tone: "checking",
    };
  }

  if (error) {
    return {
      label: "Unable to verify",
      message: "Unable to verify the key right now. Try again later.",
      tone: "error",
    };
  }

  if (response?.status === "valid") {
    return {
      label: "Active",
      message: response.message ?? "Saved API key is active.",
      tone: "valid",
    };
  }

  if (response?.status === "invalid") {
    return {
      label: "Problem",
      message: response.message ?? "The saved API key was rejected or lacks required access.",
      tone: "invalid",
    };
  }

  if (response?.status === "not_configured") {
    return {
      label: "Not configured",
      message: response.message ?? "Add a key to test it.",
      tone: "neutral",
    };
  }

  if (response?.status === "unsupported" || response?.status === "error") {
    return {
      label: "Unable to verify",
      message: response.message ?? "Unable to verify the key right now. Try again later.",
      tone: "error",
    };
  }

  return {
    label: "Checking...",
    message: "Validation is queued.",
    tone: "checking",
  };
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const updateProvider = useUpdateProvider();
  const setProviderKey = useSetProviderKey();
  const keyTestQuery = useProviderKeyTest(provider);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [keyError, setKeyError] = useState<string>();
  const hasConfiguredKey = keyTestQuery.data?.status === "not_configured"
    ? false
    : provider.has_key || keyTestQuery.data !== undefined;
  const keyStatus = resolveKeyStatus(
    hasConfiguredKey,
    keyTestQuery.isFetching,
    keyTestQuery.data,
    keyTestQuery.error,
  );

  async function handleToggleEnabled(nextEnabled: boolean) {
    try {
      await updateProvider.mutateAsync({
        id: provider.id,
        data: { enabled: nextEnabled },
      });
    } catch {
      // Error state is rendered from the mutation object.
    }
  }

  async function handleSubmitKey(key: string) {
    try {
      setKeyError(undefined);
      await setProviderKey.mutateAsync({ id: provider.id, key });
      setIsDialogOpen(false);
      void keyTestQuery.refetch();
    } catch (error) {
      if (error instanceof ApiError) {
        setKeyError(error.message);
        return;
      }

      setKeyError("Unable to save the API key right now.");
    }
  }

  function handleTestKey() {
    if (!hasConfiguredKey) {
      return;
    }

    void keyTestQuery.refetch();
  }

  return (
    <>
      <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-500">
              ID: <span className="font-mono text-gray-700">{provider.id}</span>
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
            <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
            <input
              checked={provider.enabled}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              disabled={updateProvider.isPending}
              type="checkbox"
              onChange={(event) => {
                void handleToggleEnabled(event.target.checked);
              }}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">API key</span>
              <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${KEY_STATUS_STYLES[keyStatus.tone]}`}>
                {keyStatus.label}
              </span>
            </div>
            <p className="text-sm text-gray-600">{keyStatus.message}</p>
          </div>

          <button
            aria-label={`Test ${provider.name} API key`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
            disabled={!hasConfiguredKey || keyTestQuery.isFetching}
            type="button"
            onClick={handleTestKey}
          >
            {keyTestQuery.isFetching ? "Testing..." : "Test"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            type="button"
            onClick={() => {
              setKeyError(undefined);
              setIsDialogOpen(true);
            }}
          >
            Set API Key
          </button>

          {updateProvider.error instanceof ApiError ? (
            <p className="text-sm text-red-600">{updateProvider.error.message}</p>
          ) : null}
        </div>
      </article>

      {isDialogOpen ? (
        <ApiKeyDialog
          errorMessage={keyError}
          isPending={setProviderKey.isPending}
          providerName={provider.name}
          onClose={() => {
            setKeyError(undefined);
            setIsDialogOpen(false);
          }}
          onSubmit={handleSubmitKey}
        />
      ) : null}
    </>
  );
}
