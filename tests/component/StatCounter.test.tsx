import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatCounter } from "@/components/ui/StatCounter";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StatCounter", () => {
  it("renders the fetched value", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ registrations: 42 }),
      })
    );

    render(<StatCounter statKey="registrations" label="Teams registered" pollIntervalMs={0} />);

    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
    expect(screen.getByText("Teams registered")).toBeInTheDocument();
  });

  it("shows a fallback dash on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    render(<StatCounter statKey="registrations" label="Teams registered" pollIntervalMs={0} />);

    await waitFor(() => expect(screen.getByText("—")).toBeInTheDocument());
  });
});
