import { describe, expect, it } from "vitest";
import {
  DEFAULT_GREETING,
  MAX_BUTTONS,
  MAX_EXTRA_RECIPIENTS,
  applyGreeting,
  describeSend,
  hasComposeErrors,
  normaliseCompose,
  parseAddressList,
  parseButtons,
  serialiseButtons,
  validateCompose,
} from "@/lib/broadcast-compose";

/*
  The rules that decide whether an email is fit to send, and what it says around
  the message.

  Most of these exist because the failure they describe is silent. A greeting
  token that does not get substituted arrives in somebody's inbox reading "Hi
  {name}," — nothing throws, nothing is logged, and the first anyone knows is
  when a recipient mentions it.
*/

const BODY = "<p>The maze dimensions have changed.</p>";

describe("the greeting", () => {
  it("uses the person's own name", () => {
    expect(applyGreeting("Hi {name},", "Hashem")).toBe("Hi Hashem,");
  });

  it("reads properly for somebody with no name on file", () => {
    // Most imported contacts are a bare address. "Hi ," is the giveaway that
    // nobody checked, and it goes out to the majority of a list.
    expect(applyGreeting(DEFAULT_GREETING, "")).toBe("Hi,");
    expect(applyGreeting(DEFAULT_GREETING, null)).toBe("Hi,");
    expect(applyGreeting(DEFAULT_GREETING, "   ")).toBe("Hi,");
  });

  it("trims the name rather than pasting the whitespace in", () => {
    expect(applyGreeting("Hi {name},", "  Tima  ")).toBe("Hi Tima,");
  });

  it("handles a greeting that ends on the token", () => {
    expect(applyGreeting("Dear {name}", "")).toBe("Dear");
    expect(applyGreeting("Dear {name}", "Alaa")).toBe("Dear Alaa");
  });

  it("leaves a greeting with no token alone", () => {
    expect(applyGreeting("Hello everyone,", "Hashem")).toBe("Hello everyone,");
  });
});

describe("buttons", () => {
  it("survives a round trip", () => {
    const buttons = [{ label: "Rulebook", href: "/rules" }];
    expect(parseButtons(serialiseButtons(buttons))).toEqual(buttons);
  });

  it("returns none rather than throwing on unreadable JSON", () => {
    // Read while *displaying* a draft: a bad value must not take the page down.
    expect(parseButtons("not json")).toEqual([]);
    expect(parseButtons("{}")).toEqual([]);
    expect(parseButtons("[1,2,3]")).toEqual([]);
    expect(parseButtons(null)).toEqual([]);
  });

  it("drops a button whose link is not one a mail client will follow", () => {
    expect(parseButtons('[{"label":"Click","href":"javascript:alert(1)"}]')).toEqual([]);
  });

  it("drops a half-written button", () => {
    expect(parseButtons('[{"label":"","href":"/rules"}]')).toEqual([]);
    expect(parseButtons('[{"label":"Rules","href":""}]')).toEqual([]);
  });

  it("never carries more than an email has room for", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ label: `B${i}`, href: "/x" }));
    expect(parseButtons(JSON.stringify(many))).toHaveLength(MAX_BUTTONS);
    expect(JSON.parse(serialiseButtons(many))).toHaveLength(MAX_BUTTONS);
  });
});

describe("copying people in", () => {
  it("accepts the same shapes as the contact box", () => {
    const { addresses, error } = parseAddressList(
      "Chair <chair@example.com>; advisor@example.com",
      "Cc",
    );
    expect(addresses).toEqual(["chair@example.com", "advisor@example.com"]);
    expect(error).toBeUndefined();
  });

  it("says which fragment was not an address", () => {
    const { error } = parseAddressList("chair@example.com, not-an-email", "Cc");
    expect(error).toMatch(/not-an-email/);
    expect(error).toMatch(/^Cc:/);
  });

  it("refuses to be used as a mailing list", () => {
    const many = Array.from({ length: MAX_EXTRA_RECIPIENTS + 5 }, (_, i) => `p${i}@example.com`);
    const { error, addresses } = parseAddressList(many.join(","), "Bcc");
    expect(addresses).toHaveLength(MAX_EXTRA_RECIPIENTS);
    expect(error).toMatch(/send to a list instead/i);
  });

  it("is empty and content for a blank field", () => {
    expect(parseAddressList("", "Cc")).toEqual({ addresses: [] });
    expect(parseAddressList(null, "Cc")).toEqual({ addresses: [] });
  });
});

describe("whether an email can be sent", () => {
  const ok = { subject: "Rule change", bodyHtml: BODY };

  it("accepts a complete one", () => {
    expect(hasComposeErrors(validateCompose(ok, { contactCount: 12 }))).toBe(false);
  });

  it("wants a subject", () => {
    expect(validateCompose({ ...ok, subject: "  " }, { contactCount: 12 }).subject).toBeTruthy();
  });

  it("wants words, not just markup", () => {
    // An editor leaves <p><br></p> behind after everything is deleted, which
    // looks empty and is not an empty string.
    expect(validateCompose({ ...ok, bodyHtml: "<p><br></p>" }, { contactCount: 1 }).body).toBeTruthy();
  });

  it("refuses a button with no link, naming the button", () => {
    const errors = validateCompose(
      { ...ok, buttons: [{ label: "Read the rules", href: "" }] },
      { contactCount: 1 },
    );
    expect(errors.buttons).toMatch(/Read the rules/);
  });

  it("refuses a button whose link goes nowhere a mail client follows", () => {
    const errors = validateCompose(
      { ...ok, buttons: [{ label: "Go", href: "javascript:alert(1)" }] },
      { contactCount: 1 },
    );
    expect(errors.buttons).toMatch(/https/);
  });

  it("ignores a button row that is entirely empty", () => {
    // An unused slot in the editor is not a mistake to complain about.
    const errors = validateCompose({ ...ok, buttons: [{ label: "", href: "" }] }, { contactCount: 1 });
    expect(errors.buttons).toBeUndefined();
  });

  it("refuses to send to nobody", () => {
    expect(validateCompose(ok, { contactCount: 0 }).recipients).toBeTruthy();
  });

  it("allows an empty list when somebody is copied in", () => {
    // A note to the two organisers about a list nobody has joined yet is a real
    // thing to want to send.
    const errors = validateCompose({ ...ok, cc: "chair@example.com" }, { contactCount: 0 });
    expect(errors.recipients).toBeUndefined();
    expect(hasComposeErrors(errors)).toBe(false);
  });
});

describe("shaping what gets stored", () => {
  it("keeps a half-written email, because that is what a draft is", () => {
    const shaped = normaliseCompose({ subject: "  Half  ", bodyHtml: "" });
    expect(shaped.subject).toBe("Half");
    expect(shaped.bodyHtml).toBe("");
  });

  it("drops unused button rows and keeps the rest in order", () => {
    const shaped = normaliseCompose({
      buttons: [
        { label: "", href: "" },
        { label: " Rules ", href: " /rules " },
      ],
    });
    expect(shaped.buttons).toEqual([{ label: "Rules", href: "/rules" }]);
  });
});

describe("what the send button says", () => {
  it("counts the list", () => {
    expect(describeSend({ contactCount: 42, cc: [], bcc: [] })).toBe("Send to 42 contacts");
  });

  it("counts one properly", () => {
    expect(describeSend({ contactCount: 1, cc: [], bcc: [] })).toBe("Send to 1 contact");
  });

  it("says who else is getting it", () => {
    expect(describeSend({ contactCount: 42, cc: ["a@b.c"], bcc: ["d@e.f"] })).toBe(
      "Send to 42 contacts and 2 copied in",
    );
  });

  it("does not offer to send to nobody", () => {
    expect(describeSend({ contactCount: 0, cc: [], bcc: [] })).toBe("Nobody to send to");
  });
});
