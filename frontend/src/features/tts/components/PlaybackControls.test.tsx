import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test-utils.tsx";
import { PlaybackControls } from "./PlaybackControls.tsx";

describe("PlaybackControls", () => {
  it("renders Run button when idle", () => {
    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
  });

  it("renders Stop button when playing", () => {
    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={2}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run/i })).not.toBeInTheDocument();
  });

  it("shows progress when playing", () => {
    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={2}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });

  it("calls onPlay when Run button is clicked", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={onPlay}
        onStop={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /run/i }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("calls onStop when Stop button is clicked", async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PlaybackControls
        status="playing"
        currentIndex={0}
        totalMessages={5}
        canPlay
        error={null}
        onPlay={vi.fn()}
        onStop={onStop}
      />,
    );

    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("disables Run button when canPlay is false", () => {
    renderWithProviders(
      <PlaybackControls
        status="idle"
        currentIndex={-1}
        totalMessages={5}
        canPlay={false}
        error={null}
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("shows error message when in error state", () => {
    renderWithProviders(
      <PlaybackControls
        status="error"
        currentIndex={-1}
        totalMessages={5}
        canPlay
        error="Network error"
        onPlay={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument();
  });
});
