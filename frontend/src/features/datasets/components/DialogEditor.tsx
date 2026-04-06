import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { DialogMessage, DialogWithMessages } from "../../../types/api.ts";
import {
  useCreateMessage,
  useDeleteDialog,
  useDeleteMessage,
  useDialog,
  useUpdateDialog,
  useUpdateMessage,
} from "../api/queries.ts";
import { MessageEditor, type EditableMessage } from "./MessageEditor.tsx";

function toEditableMessage(message: DialogMessage): EditableMessage {
  return {
    clientId: String(message.id),
    id: message.id,
    order: message.order,
    character: message.character,
    text: message.text,
  };
}

function getHighestOrder(messages: EditableMessage[]): number {
  return messages.reduce(
    (highest, message) => Math.max(highest, message.order),
    0,
  );
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function DialogEditor() {
  const navigate = useNavigate();
  const params = useParams();
  const parsedDialogId = Number(params.dialogId);
  const dialogId =
    Number.isInteger(parsedDialogId) && parsedDialogId > 0
      ? parsedDialogId
      : null;

  const dialogQuery = useDialog(dialogId);
  const updateDialog = useUpdateDialog();
  const deleteDialog = useDeleteDialog();
  const createMessage = useCreateMessage();
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();

  const tempIdRef = useRef(0);
  const hydratedDialogIdRef = useRef<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [messages, setMessages] = useState<EditableMessage[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  function hydrateDialog(dialog: DialogWithMessages) {
    setTitle(dialog.title);
    setDescription(dialog.description ?? "");
    setLanguage(dialog.language);
    setMessages(dialog.messages.map(toEditableMessage));
    setFormError(null);
    setFormNotice(null);
  }

  useEffect(() => {
    hydratedDialogIdRef.current = null;
  }, [dialogId]);

  useEffect(() => {
    if (!dialogQuery.data || dialogId === null) {
      return;
    }

    if (hydratedDialogIdRef.current === dialogId) {
      return;
    }

    hydrateDialog(dialogQuery.data);
    hydratedDialogIdRef.current = dialogId;
  }, [dialogId, dialogQuery.data]);

  function clearFeedback() {
    if (formError) {
      setFormError(null);
    }
    if (formNotice) {
      setFormNotice(null);
    }
  }

  function handleMessageChange(
    clientId: string,
    patch: Partial<Pick<EditableMessage, "character" | "text">>,
  ) {
    clearFeedback();
    setMessages((current) =>
      current.map((message) =>
        message.clientId === clientId ? { ...message, ...patch } : message,
      ),
    );
  }

  function handleDeleteMessageDraft(clientId: string) {
    clearFeedback();
    setMessages((current) =>
      current.filter((message) => message.clientId !== clientId),
    );
  }

  function handleAddMessage() {
    clearFeedback();
    tempIdRef.current += 1;

    setMessages((current) => [
      ...current,
      {
        clientId: `new-${tempIdRef.current}`,
        id: null,
        order: getHighestOrder(current) + 1,
        character: current.at(-1)?.character === 1 ? 2 : 1,
        text: "",
      },
    ]);
  }

  async function handleSave() {
    clearFeedback();

    if (!dialogId || !dialogQuery.data) {
      setFormError("Dialog not found.");
      return;
    }

    const nextTitle = title.trim();
    const nextDescription = description.trim();
    const nextLanguage = language.trim();
    const nextMessages = messages.map((message) => ({
      ...message,
      text: message.text.trim(),
    }));

    if (!nextTitle) {
      setFormError("Title is required.");
      return;
    }

    if (!nextLanguage) {
      setFormError("Language is required.");
      return;
    }

    if (nextMessages.some((message) => message.text.length === 0)) {
      setFormError("Each message needs text before saving.");
      return;
    }

    try {
      await persistDialogChanges({
        createMessage,
        deleteMessage,
        dialog: dialogQuery.data,
        dialogId,
        messages: nextMessages,
        nextDescription,
        nextLanguage,
        nextTitle,
        updateDialog,
        updateMessage,
      });

      const refreshedDialog = await dialogQuery.refetch();
      if (refreshedDialog.data) {
        hydrateDialog(refreshedDialog.data);
        hydratedDialogIdRef.current = dialogId;
      }
      setFormNotice("Dialog saved.");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save dialog.",
      );
    }
  }

  async function handleDeleteDialog() {
    clearFeedback();

    if (!dialogId) {
      return;
    }

    if (!window.confirm("Delete this dialog?")) {
      return;
    }

    try {
      await deleteDialog.mutateAsync({ dialogId });
      navigate("/datasets");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to delete dialog.",
      );
    }
  }

  const isSaving =
    updateDialog.isPending ||
    deleteDialog.isPending ||
    createMessage.isPending ||
    updateMessage.isPending ||
    deleteMessage.isPending;

  if (dialogId === null) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Invalid dialog id.
        </div>
      </div>
    );
  }

  if (dialogQuery.isPending) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading dialog...
        </div>
      </div>
    );
  }

  if (dialogQuery.isError || !dialogQuery.data) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
          to="/datasets"
        >
          Back to datasets
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {dialogQuery.error instanceof Error
            ? dialogQuery.error.message
            : "Failed to load dialog."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
            to="/datasets"
          >
            Back to datasets
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Dialog Editor</h1>
          <p className="mt-1 text-sm text-gray-600">
            Created {formatTimestamp(dialogQuery.data.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDeleteDialog}
            disabled={isSaving}
          >
            Delete Dialog
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Dialog"}
          </button>
        </div>
      </div>

      {formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      {formNotice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {formNotice}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-600 md:col-span-2">
                Title
                <input
                  type="text"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={title}
                  onChange={(event) => {
                    clearFeedback();
                    setTitle(event.target.value);
                  }}
                  disabled={isSaving}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Language
                <input
                  type="text"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={language}
                  onChange={(event) => {
                    clearFeedback();
                    setLanguage(event.target.value);
                  }}
                  disabled={isSaving}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-gray-600 md:col-span-2">
                Description
                <textarea
                  className="min-h-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  value={description}
                  onChange={(event) => {
                    clearFeedback();
                    setDescription(event.target.value);
                  }}
                  disabled={isSaving}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Draft message changes locally, then save the dialog once the
                  set looks right.
                </p>
              </div>

              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAddMessage}
                disabled={isSaving}
              >
                Add Message
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  No messages yet. Add the first line to start the dialog.
                </div>
              ) : (
                messages.map((message, index) => (
                  <MessageEditor
                    key={message.clientId}
                    index={index}
                    message={message}
                    onChange={handleMessageChange}
                    onDelete={handleDeleteMessageDraft}
                    disabled={isSaving}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Dialog ID</dt>
                <dd className="font-medium text-gray-900">{dialogQuery.data.id}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Messages</dt>
                <dd className="font-medium text-gray-900">{messages.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500">Language</dt>
                <dd className="font-medium text-gray-900">{language || "-"}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </section>
    </div>
  );
}

async function persistDialogChanges({
  createMessage,
  deleteMessage,
  dialog,
  dialogId,
  messages,
  nextDescription,
  nextLanguage,
  nextTitle,
  updateDialog,
  updateMessage,
}: {
  createMessage: ReturnType<typeof useCreateMessage>;
  deleteMessage: ReturnType<typeof useDeleteMessage>;
  dialog: DialogWithMessages;
  dialogId: number;
  messages: EditableMessage[];
  nextDescription: string;
  nextLanguage: string;
  nextTitle: string;
  updateDialog: ReturnType<typeof useUpdateDialog>;
  updateMessage: ReturnType<typeof useUpdateMessage>;
}) {
  const metadataChanged =
    dialog.title !== nextTitle ||
    (dialog.description ?? "") !== nextDescription ||
    dialog.language !== nextLanguage;

  if (metadataChanged) {
    await updateDialog.mutateAsync({
      dialogId,
      data: {
        title: nextTitle,
        description: nextDescription,
        language: nextLanguage,
      },
    });
  }

  const originalById = new Map(
    dialog.messages.map((message) => [message.id, message]),
  );
  const currentIds = new Set(
    messages
      .filter((message) => message.id !== null)
      .map((message) => message.id as number),
  );

  const deletedIds = dialog.messages
    .filter((message) => !currentIds.has(message.id))
    .map((message) => message.id);

  const changedMessages = messages.filter((message) => {
    if (message.id === null) {
      return false;
    }

    const original = originalById.get(message.id);
    return (
      !original ||
      original.character !== message.character ||
      original.text !== message.text
    );
  });

  const newMessages = messages
    .filter((message) => message.id === null)
    .sort((left, right) => left.order - right.order);

  for (const message of changedMessages) {
    await updateMessage.mutateAsync({
      dialogId,
      messageId: message.id!,
      data: {
        character: message.character,
        text: message.text,
      },
    });
  }

  for (const message of newMessages) {
    await createMessage.mutateAsync({
      dialogId,
      data: {
        order: message.order,
        character: message.character,
        text: message.text,
      },
    });
  }

  for (const messageId of deletedIds) {
    await deleteMessage.mutateAsync({
      dialogId,
      messageId,
    });
  }
}
