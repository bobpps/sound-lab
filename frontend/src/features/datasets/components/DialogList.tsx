import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Dialog } from "../../../types/api.ts";
import { useCreateDialog, useDialogs } from "../api/queries.ts";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function sortDialogs(dialogs: Dialog[]): Dialog[] {
  return [...dialogs].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

export function DialogList() {
  const navigate = useNavigate();
  const dialogsQuery = useDialogs();
  const createDialog = useCreateDialog();
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateDialog() {
    setCreateError(null);

    try {
      const dialog = await createDialog.mutateAsync({
        title: "Untitled dialog",
        language: "en-US",
      });
      navigate(`/datasets/dialogs/${dialog.id}`);
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create dialog.",
      );
    }
  }

  const dialogs = dialogsQuery.data ? sortDialogs(dialogsQuery.data) : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Dialogs</h2>
          <p className="mt-1 text-sm text-gray-600">
            Browse existing datasets and jump straight into the dialog editor.
          </p>
        </div>

        <button
          type="button"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleCreateDialog}
          disabled={createDialog.isPending}
        >
          {createDialog.isPending ? "Creating..." : "New Dialog"}
        </button>
      </div>

      {createError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {createError}
        </div>
      ) : null}

      {dialogsQuery.isPending ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading dialogs...
        </div>
      ) : null}

      {dialogsQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {dialogsQuery.error instanceof Error
            ? dialogsQuery.error.message
            : "Failed to load dialogs."}
        </div>
      ) : null}

      {!dialogsQuery.isPending &&
      !dialogsQuery.isError &&
      dialogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-600 shadow-sm">
          No dialogs yet. Create the first one to start building datasets.
        </div>
      ) : null}

      {!dialogsQuery.isPending &&
      !dialogsQuery.isError &&
      dialogs.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dialogs.map((dialog) => (
                <tr key={dialog.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <Link
                      to={`/datasets/dialogs/${dialog.id}`}
                      className="font-medium text-gray-900 underline-offset-2 hover:underline"
                    >
                      {dialog.title}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {dialog.language}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {formatDate(dialog.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
