import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VoiceResultCard } from "./VoiceResultCard.tsx";

describe("VoiceResultCard", () => {
  it("shows a spinner/pending label while pending and disables play", () => {
    render(
      <VoiceResultCard
        label="en-US-Standard-A"
        result={{ status: "pending" }}
        onPlay={() => {}}
      />,
    );
    expect(screen.getByText("en-US-Standard-A")).toBeInTheDocument();
    expect(screen.getByText(/synthesizing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });

  it("enables play when done and calls onPlay with the url", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    render(
      <VoiceResultCard
        label="en-US-Standard-A"
        result={{ status: "done", url: "blob:mock-1" }}
        onPlay={onPlay}
      />,
    );
    const btn = screen.getByRole("button", { name: /play/i });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onPlay).toHaveBeenCalledWith("blob:mock-1");
  });

  it("shows the error message when status is error", () => {
    render(
      <VoiceResultCard
        label="en-US-Standard-A"
        result={{ status: "error", error: "boom" }}
        onPlay={() => {}}
      />,
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play/i })).toBeDisabled();
  });
});
