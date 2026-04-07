import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { DialogSelector } from "./DialogSelector.tsx";

const dialogs = [
  {
    id: 1,
    title: "Greeting practice",
    description: null,
    language: "en-US",
    created_by: null,
    created_at: "2026-04-01T10:00:00.000Z",
  },
  {
    id: 2,
    title: "Support escalation",
    description: null,
    language: "en-GB",
    created_by: null,
    created_at: "2026-04-02T10:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DialogSelector", () => {
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(dialogs)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    onSelect.mockReset();
  });

  it("renders dialogs as options and calls onSelect", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", { name: "Dialog" });

    await user.selectOptions(select, "1");

    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("shows loading state", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(screen.getByText("Loading dialogs...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ message: "Server error" }, 500)),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("Failed to load dialogs."),
    ).toBeInTheDocument();
  });

  it("reflects the selected dialog", async () => {
    renderWithProviders(
      <DialogSelector selectedId={2} onSelect={onSelect} />,
    );

    const select = await screen.findByRole("combobox", { name: "Dialog" });

    expect(select).toHaveValue("2");
  });

  it("shows empty state when no dialogs exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([])),
    );

    renderWithProviders(
      <DialogSelector selectedId={null} onSelect={onSelect} />,
    );

    expect(
      await screen.findByText("No dialogs available."),
    ).toBeInTheDocument();
  });
});
