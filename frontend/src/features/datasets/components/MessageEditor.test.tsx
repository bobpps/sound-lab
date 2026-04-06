import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import {
  MessageEditor,
  type EditableMessage,
} from "./MessageEditor.tsx";

function MessageEditorHarness({
  onChange,
  onDelete,
}: {
  onChange: (
    clientId: string,
    patch: Partial<Pick<EditableMessage, "character" | "text">>,
  ) => void;
  onDelete: (clientId: string) => void;
}) {
  const [message, setMessage] = useState<EditableMessage>({
    clientId: "message-1",
    id: 1,
    order: 1,
    character: 1,
    text: "Hello there",
  });

  return (
    <MessageEditor
      index={0}
      message={message}
      onChange={(clientId, patch) => {
        onChange(clientId, patch);
        setMessage((current) => ({ ...current, ...patch }));
      }}
      onDelete={onDelete}
    />
  );
}

describe("MessageEditor", () => {
  it("emits character, text, and delete changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onDelete = vi.fn();

    renderWithProviders(
      <MessageEditorHarness onChange={onChange} onDelete={onDelete} />,
    );

    await user.selectOptions(screen.getByLabelText("Character"), "2");
    expect(onChange).toHaveBeenCalledWith("message-1", { character: 2 });

    await user.clear(screen.getByLabelText("Text"));
    await user.type(screen.getByLabelText("Text"), "Updated");
    expect(onChange).toHaveBeenLastCalledWith("message-1", { text: "Updated" });
    expect(screen.getByLabelText("Text")).toHaveValue("Updated");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("message-1");
  });
});
