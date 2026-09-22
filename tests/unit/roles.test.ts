import { describe, expect, it } from "vitest";
import { ADMIN_LINKS } from "@/lib/admin-nav";
import { SECTION_ROLES, canOpen, parseRoles, rolesForPath, serializeRoles } from "@/lib/roles";

describe("parseRoles", () => {
  it("reads a comma list in any case, in canonical order, dropping junk", () => {
    expect(parseRoles("media, scoring,BOGUS")).toEqual(["SCORING", "MEDIA"]);
    expect(parseRoles("")).toEqual([]);
    expect(parseRoles(null)).toEqual([]);
  });

  it("round-trips through serializeRoles without duplicates", () => {
    expect(serializeRoles(["MEDIA", "MASTER", "MEDIA"])).toBe("MASTER,MEDIA");
  });
});

describe("who opens what", () => {
  it("lets Master open everything, including screens nobody listed", () => {
    for (const link of ADMIN_LINKS) expect(canOpen(["MASTER"], link.href)).toBe(true);
    expect(canOpen(["MASTER"], "/admin/some-future-screen")).toBe(true);
  });

  it("keeps an unlisted screen Master only rather than open to everyone", () => {
    expect(rolesForPath("/admin/some-future-screen")).toEqual(["MASTER"]);
    expect(canOpen(["SCORING"], "/admin/some-future-screen")).toBe(false);
    expect(canOpen(["SCORING"], "/admin/day/something-new")).toBe(false);
  });

  it("gives every role the dashboard and the day hub", () => {
    for (const role of ["REGISTRATION", "SCORING", "MEDIA", "OPERATIONS"] as const) {
      expect(canOpen([role], "/admin")).toBe(true);
      expect(canOpen([role], "/admin/day")).toBe(true);
    }
  });

  it("keeps scoring out of money and registrations", () => {
    expect(canOpen(["SCORING"], "/admin/day/scoring")).toBe(true);
    expect(canOpen(["SCORING"], "/admin/payments")).toBe(false);
    expect(canOpen(["SCORING"], "/admin/payments/screenshot/abc")).toBe(false);
    expect(canOpen(["SCORING"], "/admin/registrations")).toBe(false);
    expect(canOpen(["SCORING"], "/api/registrations/export")).toBe(false);
  });

  it("gives registration its desks and nothing about admins", () => {
    expect(canOpen(["REGISTRATION"], "/admin/day/check-in")).toBe(true);
    expect(canOpen(["REGISTRATION"], "/admin/payments/review")).toBe(true);
    expect(canOpen(["REGISTRATION"], "/admin/admins")).toBe(false);
    expect(canOpen(["REGISTRATION"], "/admin/day-mode")).toBe(false);
  });

  it("combines roles: media plus operations opens both desks", () => {
    expect(canOpen(["MEDIA", "OPERATIONS"], "/admin/day/guides")).toBe(true);
    expect(canOpen(["MEDIA", "OPERATIONS"], "/admin/day/volunteers")).toBe(true);
    expect(canOpen(["MEDIA", "OPERATIONS"], "/admin/day/scoring")).toBe(false);
  });

  it("opens nothing but the dashboard and hub for an account with no role", () => {
    const open = ADMIN_LINKS.filter((link) => canOpen([], link.href)).map((link) => link.href);
    expect(open.sort()).toEqual(["/admin", "/admin/day"]);
  });

  it("has an explicit entry for every screen in the admin menu", () => {
    for (const link of ADMIN_LINKS) expect(Object.keys(SECTION_ROLES)).toContain(link.href);
  });
});
