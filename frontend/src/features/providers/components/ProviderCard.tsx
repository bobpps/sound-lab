import { useState } from "react";
import { ApiError } from "../../../lib/api-client.ts";
import type { Provider } from "../../../types/api.ts";
import { useSetProviderKey, useUpdateProvider } from "../api/queries.ts";
import { ApiKeyDialog } from "./ApiKeyDialog.tsx";

interface ProviderCardProps {
  provider: Provider;
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const updateProvider = useUpdateProvider();
  const setProviderKey = useSetProviderKey();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [keyError, setKeyError] = useState<string>();

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
    } catch (error) {
      if (error instanceof ApiError) {
        setKeyError(error.message);
        return;
      }

      setKeyError("Unable to save the API key right now.");
    }
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
