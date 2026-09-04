import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * Which admin page you are on, according to the sidebar.
 *
 * Worth pinning down because the nav has twelve items that are otherwise
 * identical, and the failure is silent: a rule that matches nothing leaves the
 * whole column looking inert, and a rule that matches too much lights up
 * Dashboard on every screen. Both look fine until you try to use them.
 */

let pathname = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const { AdminNav, isActiveLink } = await import("@/components/admin/AdminNav");

afterEach(() => {
  cleanup();
});

const renderAt = (at: string) => {
  pathname = at;
  render(<AdminNav />);
};

describe("isActiveLink", () => {
  it("matches the dashboard only exactly", () => {
    // Every admin route begins with /admin, so a prefix rule here would light
    // Dashboard up on all twelve screens.
    expect(isActiveLink("/admin", "/admin")).toBe(true);
    expect(isActiveLink("/admin", "/admin/payments")).toBe(false);
  });

  it("keeps a section lit on its own detail routes", () => {
    expect(isActiveLink("/admin/gallery", "/admin/gallery")).toBe(true);
    expect(isActiveLink("/admin/gallery", "/admin/gallery/abc123")).toBe(true);
  });

  it("does not match a sibling that merely starts with the same text", () => {
    expect(isActiveLink("/admin/pages", "/admin/pages-archive")).toBe(false);
  });
});

describe("AdminNav", () => {
  it("marks exactly one item as the current page", () => {
    renderAt("/admin/payments");
    const current = screen.getAllByRole("link").filter((el) => el.getAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Payments");
  });

  it("keeps Gallery current on an album's own page", () => {
    renderAt("/admin/gallery/abc123");
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent("Gallery");
  });

  it("marks only Dashboard at the root, not every section", () => {
    renderAt("/admin");
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent("Dashboard");
  });

  it("still renders a text label beside every icon", () => {
    // The icons are decorative; a nav that relied on them would be unusable to
    // anyone who does not already know what a shield means.
    renderAt("/admin");
    expect(screen.getByRole("link", { name: "Registrations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Competition Day" })).toBeInTheDocument();
  });
});
