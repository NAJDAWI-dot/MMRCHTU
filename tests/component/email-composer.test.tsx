import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The composer on the email list page.
 *
 * The actions it calls need a session, a database, a blob store and a mail
 * provider, so they are stubbed. What is worth pinning here is everything that
 * stands between an admin and forty people receiving something wrong: that the
 * send button says who it is about to mail, that a mistyped address is caught
 * while it is being typed rather than at send, that the preview shows formatted
 * words and never raw markup, and that an error coming back from the server
 * lands on the field it belongs to.
 */

const beginSend = vi.fn();
const sendNextBatch = vi.fn();
const saveDraft = vi.fn();
const sendTest = vi.fn();
const detachFile = vi.fn();

vi.mock("@/app/admin/(protected)/broadcasts/compose-actions", () => ({
  beginSend: (...args: unknown[]) => beginSend(...args),
  sendNextBatch: (...args: unknown[]) => sendNextBatch(...args),
  saveDraft: (...args: unknown[]) => saveDraft(...args),
  saveAsTemplate: vi.fn(),
  discardDraft: vi.fn(),
  attachFile: vi.fn(),
  detachFile: (...args: unknown[]) => detachFile(...args),
  sendTest: (...args: unknown[]) => sendTest(...args),
}));

const { EmailComposer } = await import("@/app/admin/(protected)/broadcasts/EmailComposer");

const DEFAULTS = {
  greeting: "Hi {name},",
  signOff: "— IEEE RAS HTU Student Chapter",
  footerNote: "You are on an MMRC 26 list.",
  buttons: [],
};

function renderComposer(overrides: Partial<Parameters<typeof EmailComposer>[0]> = {}) {
  return render(
    <EmailComposer
      listId="list-1"
      listName="Confirmed teams"
      contactCount={3}
      draft={null}
      templates={[]}
      defaults={DEFAULTS}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the send button", () => {
  it("says how many people are about to get this", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: "Send to 3 contacts" })).toBeTruthy();
  });

  it("counts one contact properly", () => {
    renderComposer({ contactCount: 1 });
    expect(screen.getByRole("button", { name: "Send to 1 contact" })).toBeTruthy();
  });

  it("includes the people copied in, as they are typed", () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText("Cc"), {
      target: { value: "chair@example.com" },
    });
    expect(screen.getByRole("button", { name: "Send to 3 contacts and 1 copied in" })).toBeTruthy();
  });

  it("does not offer to send to nobody", () => {
    renderComposer({ contactCount: 0 });
    expect(screen.getByRole("button", { name: "Nobody to send to" })).toBeTruthy();
  });
});

describe("copying people in", () => {
  it("says plainly that they get one copy, not one each", () => {
    // The one thing about cc here that is not what people expect, on a screen
    // where the wrong assumption means somebody receives forty emails.
    renderComposer();
    // Read off the whole rendered text, because the emphasis on "one" splits
    // the sentence across elements and every ancestor matches it too.
    expect(document.body.textContent).toMatch(/one copy of the same email/i);
  });

  it("catches a mistyped address while it is being typed", () => {
    renderComposer();
    fireEvent.change(screen.getByLabelText("Cc"), {
      target: { value: "chair@example.com, not-an-email" },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/not-an-email/);
  });
});

describe("buttons in the email", () => {
  it("adds a row and takes it away again", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Add a button" }));

    const label = screen.getByLabelText("Button 1 words");
    fireEvent.change(label, { target: { value: "Read the rulebook" } });
    expect((label as HTMLInputElement).value).toBe("Read the rulebook");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByLabelText("Button 1 words")).toBeNull();
  });

  it("stops at three, and says why", () => {
    renderComposer();
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Add a button" }));
    }
    expect(screen.queryByRole("button", { name: "Add a button" })).toBeNull();
    expect(screen.getByText(/up to three buttons/i)).toBeTruthy();
  });
});

describe("the preview", () => {
  const draft = {
    id: "draft-1",
    subject: "Rule change",
    bodyHtml: "<p>Wall height is now <strong>5cm</strong>.</p>",
    greeting: "Hi {name},",
    signOff: "— The chapter",
    footerNote: "",
    buttons: [],
    cc: "",
    bcc: "",
    attachments: [],
  };

  it("shows the words formatted, not the markup", () => {
    renderComposer({ draft });
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));

    expect(screen.getAllByText(/Wall height is now/).length).toBeGreaterThan(0);
    // The tags themselves must never appear as text — that would mean the body
    // was escaped twice and the email would go out full of visible markup.
    expect(document.body.textContent).not.toContain("<strong>");
  });

  it("shows the greeting with a real name in it, since {name} would not be sent", () => {
    renderComposer({ draft });
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    expect(screen.getByText("Hi Hashem,")).toBeTruthy();
  });

  it("says the header and footer are not in it, so nobody reads it as the whole email", () => {
    renderComposer({ draft });
    fireEvent.click(screen.getByRole("button", { name: "Show preview" }));
    expect(screen.getByText(/send yourself a test/i)).toBeTruthy();
  });
});

describe("the message box", () => {
  const draft = {
    id: "draft-1",
    subject: "Rule change",
    bodyHtml: "<p>Original text.</p>",
    greeting: "Hi {name},",
    signOff: "",
    footerNote: "",
    buttons: [],
    cc: "",
    bcc: "",
    attachments: [],
  };

  /*
    These pin the contract, and one of them regresses.

    The bug they were written for: the editor's content arrived through
    dangerouslySetInnerHTML, so React owned those child nodes and put the
    original back on every re-render — and there is a re-render per keystroke,
    because the preview updates as you type. The box took focus, accepted
    keystrokes, and kept none of them.

    Only the template case below actually fails against that version. jsdom does
    not reproduce the restore: setting innerHTML by hand is not the same as a
    browser editing a contenteditable, and React's commit behaves differently
    against the two. The typing tests are still worth having as a statement of
    what must hold, but the guard that caught this — and the one that would
    catch it again — is driving a real browser.
  */
  it("keeps what was typed when the page re-renders around it", () => {
    renderComposer({ draft });
    const editor = screen.getByRole("textbox", { name: "Message" });

    editor.innerHTML = "<p>Typed by hand</p>";
    fireEvent.input(editor);

    // Anything at all that re-renders the composer.
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Changed" } });

    expect(editor.innerHTML).toContain("Typed by hand");
    expect(editor.innerHTML).not.toContain("Original text");
  });

  it("carries what was typed into the form data the actions receive", () => {
    renderComposer({ draft });
    const editor = screen.getByRole("textbox", { name: "Message" });

    editor.innerHTML = "<p>Typed by hand</p>";
    fireEvent.input(editor);

    const hidden = document.querySelector('input[type="hidden"][name="bodyHtml"]');
    expect((hidden as HTMLInputElement | null)?.value).toContain("Typed by hand");
  });

  it("replaces the text when an email is started from a template", () => {
    // The same ownership problem the other way round: setting state alone
    // changed the preview and left the editor showing the previous email.
    renderComposer({
      draft,
      templates: [
        {
          id: "t1",
          name: "Week-before reminder",
          subject: "One week to go",
          bodyHtml: "<p>From the template.</p>",
          greeting: "Hi {name},",
          signOff: "",
          footerNote: "",
          buttons: [],
        },
      ],
    });

    fireEvent.change(screen.getByLabelText("Start from"), { target: { value: "t1" } });

    const editor = screen.getByRole("textbox", { name: "Message" });
    expect(editor.innerHTML).toContain("From the template");
    expect(editor.innerHTML).not.toContain("Original text");
  });
});

describe("what the server says", () => {
  it("puts a rejected send's error on the field it is about", async () => {
    beginSend.mockResolvedValue({
      ok: false,
      message: "This email is not ready to send — see the fields marked below.",
      errors: { subject: "Give the email a subject — it is the first thing anyone reads." },
      total: 0,
      sent: 0,
      failed: 0,
      done: false,
    });

    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Send to 3 contacts" }));

    expect(await screen.findByText(/first thing anyone reads/i)).toBeTruthy();
    expect(sendNextBatch).not.toHaveBeenCalled();
  });

  it("keeps sending batches until the run is done", async () => {
    beginSend.mockResolvedValue({ ok: true, message: null, draftId: "d1", total: 25, sent: 0, failed: 0, done: false });
    sendNextBatch
      .mockResolvedValueOnce({ ok: true, message: null, draftId: "d1", total: 25, sent: 10, failed: 0, done: false })
      .mockResolvedValueOnce({ ok: true, message: null, draftId: "d1", total: 25, sent: 20, failed: 0, done: false })
      .mockResolvedValueOnce({ ok: true, message: "Sent to 25 contacts.", draftId: "d1", total: 25, sent: 25, failed: 0, done: true });

    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Send to 3 contacts" }));

    expect(await screen.findByText(/Sent to 25 contacts\./)).toBeTruthy();
    // Three batches for twenty-five people, and then it stops — a loop that
    // does not stop would keep mailing.
    expect(sendNextBatch).toHaveBeenCalledTimes(3);
  });

  it("reports a failure without claiming success", async () => {
    beginSend.mockResolvedValue({ ok: true, message: null, draftId: "d1", total: 2, sent: 0, failed: 0, done: false });
    sendNextBatch.mockResolvedValue({
      ok: false,
      message: "Sent to 1 of 2. Failed: nope@example.test",
      draftId: "d1",
      total: 2,
      sent: 1,
      failed: 1,
      done: true,
    });

    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Send to 3 contacts" }));

    const notice = await screen.findByTestId("composer-notice");
    expect(notice.textContent).toMatch(/nope@example\.test/);
  });
});

describe("attachments", () => {
  const draft = {
    id: "draft-1",
    subject: "With a file",
    bodyHtml: "<p>See attached.</p>",
    greeting: "Hi {name},",
    signOff: "",
    footerNote: "",
    buttons: [],
    cc: "",
    bcc: "",
    attachments: [
      { id: "a1", filename: "rulebook.pdf", size: 2 * 1024 * 1024, contentType: "application/pdf" },
    ],
  };

  it("lists what is attached, with its size", () => {
    renderComposer({ draft });
    expect(screen.getByText("rulebook.pdf")).toBeTruthy();
    expect(screen.getByText("2.0 MB")).toBeTruthy();
  });

  it("removes one through the server rather than only on screen", async () => {
    detachFile.mockResolvedValue({ ok: true, message: "Removed rulebook.pdf." });
    renderComposer({ draft });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByText(/Removed rulebook\.pdf/)).toBeTruthy();
    expect(detachFile).toHaveBeenCalledTimes(1);
  });
});
