import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { DatasetsPage } from "./DatasetsPage.tsx";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse([])),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DatasetsPage", () => {
  it("switches between dialogs and prompts tabs", async () => {
    const user = userEvent.setup();

    renderWithProviders(<DatasetsPage />);

    expect(
      await screen.findByRole("heading", { name: "Dialogs" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prompts" }));

    expect(
      screen.getByRole("heading", { name: "Prompts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Prompt management lands in the next task/i),
    ).toBeInTheDocument();
  });
});
