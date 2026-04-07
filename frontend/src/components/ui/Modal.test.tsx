import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test-utils.tsx";
import { Modal } from "./Modal.tsx";

describe("Modal", () => {
  it("renders content and closes through the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <Modal
        title="Generate dialog"
        description="Select a provider and model"
        footer={<button type="button">Footer action</button>}
        onClose={onClose}
      >
        <p>Body content</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "Generate dialog" })).toBeInTheDocument();
    expect(screen.getByText("Select a provider and model")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Footer action" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
