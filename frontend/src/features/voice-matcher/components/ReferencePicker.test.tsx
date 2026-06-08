import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestWrapper } from "../../../test-utils.tsx";
import { ReferencePicker } from "./ReferencePicker.tsx";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const geminiVoices = [
  { id: "Kore", name: "Kore", language: "multi", gender: "female" },
  { id: "Puck", name: "Puck", language: "multi", gender: "male" },
];

describe("ReferencePicker", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(geminiVoices)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the voice select and shows the gender badge for the selected voice", async () => {
    render(
      <ReferencePicker voiceId="Kore" onVoiceChange={() => {}} />,
      { wrapper: createTestWrapper() },
    );

    expect(
      await screen.findByRole("option", { name: "Kore (female)" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Reference model")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reference voice")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
  });

  it("calls onVoiceChange when the voice select changes", async () => {
    const onVoiceChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ReferencePicker voiceId="Kore" onVoiceChange={onVoiceChange} />,
      { wrapper: createTestWrapper() },
    );

    await screen.findByRole("option", { name: "Puck (male)" });
    await user.selectOptions(screen.getByLabelText("Reference voice"), "Puck");
    expect(onVoiceChange).toHaveBeenCalledWith("Puck");
  });
});
