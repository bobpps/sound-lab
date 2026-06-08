import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TextInput } from "./TextInput.tsx";

describe("TextInput", () => {
  it("renders the current value and calls onChange on typing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TextInput value="" onChange={onChange} />);
    await user.type(screen.getByLabelText("Phrase"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows the provided value", () => {
    render(<TextInput value="hello world" onChange={() => {}} />);
    expect(screen.getByLabelText("Phrase")).toHaveValue("hello world");
  });
});
