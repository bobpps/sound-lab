import { useId, useState } from "react";

interface ApiKeyDialogProps {
  providerName: string;
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (key: string) => Promise<void>;
}

export function ApiKeyDialog({
  providerName,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: ApiKeyDialogProps) {
  const inputId = useId();
  const [key, setKey] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(key.trim());
  }

  return (
    <div
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-gray-900" id={`${inputId}-title`}>
            Set API Key
          </h2>
          <p className="text-sm text-gray-600">
            Save a new API key for <span className="font-medium text-gray-900">{providerName}</span>.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700" htmlFor={inputId}>
              API key
            </label>
            <input
              required
              autoFocus
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-200"
              id={inputId}
              minLength={1}
              placeholder="Enter a new secret"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              disabled={isPending || key.trim().length === 0}
              type="submit"
            >
              {isPending ? "Saving..." : "Save API Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
