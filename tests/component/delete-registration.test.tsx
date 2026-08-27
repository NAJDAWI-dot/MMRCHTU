import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The two-step guard on the one irreversible action in the admin.
 *
 * The action itself cannot be exercised here — it needs a session, a database
 * and a blob store — so what is pinned down is the part that protects an admin
 * from themselves: a single click must never delete anything, and the armed
 * state must name the team it is about to remove. A long list of registrations
 * is exactly where a misclick happens, and there is no undo.
 */

const deleteRegistration = vi.fn();
vi.mock("@/app/admin/(protected)/registrations/actions", () => ({
  deleteRegistration: (...args: unknown[]) => deleteRegistration(...args),
}));

// useFormStatus is a Server-Actions hook and is not wired up by the plain
// react-dom build vitest resolves. The component only uses it to disable the
// button while a delete is in flight, which is not what these tests are about.
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: false }),
}));

const { DeleteRegistration } = await import("@/components/admin/DeleteRegistration");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DeleteRegistration", () => {
  it("shows only a Delete button to begin with", () => {
    render(<DeleteRegistration id="reg-1" teamName="Maze Runners" />);

    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /yes, delete/i })).toBeNull();
  });

  it("does not submit anything on the first click", () => {
    render(<DeleteRegistration id="reg-1" teamName="Maze Runners" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  it("names the team and warns about the screenshot once armed", () => {
    // So a misclick on a long list is caught by reading, not by remembering
    // which row was pressed.
    render(<DeleteRegistration id="reg-1" teamName="Maze Runners" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText("Maze Runners")).toBeTruthy();
    expect(screen.getByText(/its members and its payment screenshot/i)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/i)).toBeTruthy();
  });

  it("carries the id the action needs", () => {
    render(<DeleteRegistration id="reg-42" teamName="Maze Runners" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const field = document.querySelector('input[name="id"]') as HTMLInputElement | null;
    expect(field?.value).toBe("reg-42");
  });

  it("can be backed out of", () => {
    render(<DeleteRegistration id="reg-1" teamName="Maze Runners" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("button", { name: /yes, delete/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(deleteRegistration).not.toHaveBeenCalled();
  });
});
