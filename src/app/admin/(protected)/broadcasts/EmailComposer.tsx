"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { RichTextEditor, type EditorHandle } from "./RichTextEditor";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_TYPE_SUMMARY,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  checkAttachment,
  formatBytes,
} from "@/lib/attachment";
import {
  MAX_BUTTONS,
  NAME_TOKEN,
  applyGreeting,
  describeSend,
  parseAddressList,
  type EmailButton,
} from "@/lib/broadcast-compose";
import { renderRichText } from "@/lib/rich-text";
import { EMAIL_CRIMSON, EMAIL_GRAY, EMAIL_SURFACE } from "@/lib/email-theme";
import {
  attachFile,
  beginSend,
  detachFile,
  discardDraft,
  saveAsTemplate,
  saveDraft,
  sendNextBatch,
  sendTest,
  type ComposerResult,
  type SendProgress,
} from "./compose-actions";

/**
 * The whole email, written on the list's own page.
 *
 * One client component rather than a form per action, and one piece of state
 * rather than a form's fields, because every action here needs the *current*
 * email: attaching a file has to know the subject so the draft it creates is
 * not blank, and sending has to know everything. Nested forms would be the
 * natural HTML shape for four buttons that do four different things, and are
 * not legal — so the actions are called directly with FormData built here.
 */

export interface ComposerAttachment {
  id: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface ComposerDraft {
  id: string;
  subject: string;
  bodyHtml: string;
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: EmailButton[];
  cc: string;
  bcc: string;
  attachments: ComposerAttachment[];
}

export interface ComposerTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  greeting: string;
  signOff: string;
  footerNote: string;
  buttons: EmailButton[];
}

const FIELD =
  "w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-ras-purple focus:outline-none";
const LABEL = "block text-xs font-medium text-ras-gray dark:text-white/70";
const SUMMARY =
  "cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-ras-gray hover:text-ras-purple dark:text-white/60 dark:hover:text-white";

export function EmailComposer({
  listId,
  listName,
  contactCount,
  draft,
  templates,
  defaults,
}: {
  listId: string;
  listName: string;
  contactCount: number;
  draft: ComposerDraft | null;
  templates: ComposerTemplate[];
  defaults: { greeting: string; signOff: string; footerNote: string; buttons: EmailButton[] };
}) {
  const [draftId, setDraftId] = useState(draft?.id ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.bodyHtml ?? "");
  const [greeting, setGreeting] = useState(draft?.greeting || defaults.greeting);
  const [signOff, setSignOff] = useState(draft?.signOff || defaults.signOff);
  const [footerNote, setFooterNote] = useState(draft?.footerNote || defaults.footerNote);
  const [buttons, setButtons] = useState<EmailButton[]>(draft?.buttons ?? defaults.buttons);
  const [cc, setCc] = useState(draft?.cc ?? "");
  const [bcc, setBcc] = useState(draft?.bcc ?? "");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>(draft?.attachments ?? []);
  const [templateName, setTemplateName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [result, setResult] = useState<ComposerResult | null>(null);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement | null>(null);

  // The editor is uncontrolled; this is the value it last reported.
  const bodyRef = useRef(draft?.bodyHtml ?? "");
  // The one way to put content *into* it, for starting from a template.
  const editor = useRef<EditorHandle | null>(null);

  function formData(extra?: Record<string, string>): FormData {
    const data = new FormData();
    data.set("draftId", draftId);
    data.set("listId", listId);
    data.set("subject", subject);
    data.set("bodyHtml", bodyRef.current);
    data.set("greeting", greeting);
    data.set("signOff", signOff);
    data.set("footerNote", footerNote);
    data.set("cc", cc);
    data.set("bcc", bcc);
    data.set("templateName", templateName);
    data.set("testEmail", testEmail);
    buttons.forEach((item, index) => {
      data.set(`buttonLabel${index}`, item.label);
      data.set(`buttonHref${index}`, item.href);
    });
    for (const [key, value] of Object.entries(extra ?? {})) data.set(key, value);
    return data;
  }

  function run(action: (data: FormData) => Promise<ComposerResult>, extra?: Record<string, string>) {
    startTransition(async () => {
      const outcome = await action(formData(extra));
      if (outcome.draftId) setDraftId(outcome.draftId);
      setResult(outcome);
    });
  }

  /**
   * Sends in batches until there are none left.
   *
   * The loop lives in the browser rather than in one long server call: a list
   * of any size is then a series of short requests, none of which a serverless
   * platform will cut off, and the count on screen is the count in the
   * database rather than a guess.
   */
  function send() {
    startTransition(async () => {
      const started = await beginSend(formData());
      if (started.draftId) setDraftId(started.draftId);
      if (!started.ok) {
        setResult(started);
        setProgress(null);
        return;
      }
      setResult(null);
      setProgress(started);

      let current = started;
      // Bounded rather than while(true): a bug that stopped advancing the
      // counters would otherwise hammer the send endpoint forever.
      const maxRounds = Math.ceil(Math.max(started.total, 1) / 5) + 20;
      for (let round = 0; round < maxRounds && !current.done; round += 1) {
        const data = new FormData();
        data.set("draftId", started.draftId ?? draftId);
        data.set("listId", listId);
        current = await sendNextBatch(data);
        setProgress(current);
        if (!current.ok && current.done) break;
      }

      setProgress(current.done ? current : { ...current, done: true });
      setResult({ ok: current.ok, message: current.message, draftId: current.draftId });
      if (current.done && current.ok) {
        // The draft has become the sent record, so the composer starts clean
        // rather than offering to send the same email again. The editor is
        // emptied through its handle, since its content is in the DOM and
        // clearing the state alone would leave the sent email on screen.
        setDraftId("");
        setSubject("");
        editor.current?.setContent("");
        setBody("");
        bodyRef.current = "";
        setAttachments([]);
        setCc("");
        setBcc("");
      }
    });
  }

  function upload(file: File) {
    const problem = checkAttachment(
      { name: file.name, type: file.type, size: file.size },
      {
        alreadyAttached: attachments.length,
        bytesAttached: attachments.reduce((total, item) => total + item.size, 0),
      },
    );
    if (problem) {
      setResult({ ok: false, message: problem });
      return;
    }
    const data = formData();
    data.set("file", file);
    startTransition(async () => {
      const outcome = await attachFile(data);
      if (outcome.draftId) setDraftId(outcome.draftId);
      setResult(outcome);
      // The server owns the list; re-reading it is what makes a rejected upload
      // visibly *not* appear rather than appearing and then vanishing.
      if (outcome.ok) window.location.reload();
    });
  }

  function loadTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setSubject(template.subject);
    // Through the editor's own handle. Setting the state alone changed the
    // preview and left the editor showing the previous email, because the
    // editor's content lives in the DOM rather than in React.
    editor.current?.setContent(template.bodyHtml);
    setBody(template.bodyHtml);
    bodyRef.current = template.bodyHtml;
    setGreeting(template.greeting);
    setSignOff(template.signOff);
    setFooterNote(template.footerNote);
    setButtons(template.buttons);
    setResult({ ok: true, message: `Started from "${template.name}".` });
  }

  const preview = useMemo(() => renderRichText(body), [body]);
  const ccList = useMemo(() => parseAddressList(cc, "Cc"), [cc]);
  const bccList = useMemo(() => parseAddressList(bcc, "Bcc"), [bcc]);
  const attachedBytes = attachments.reduce((total, item) => total + item.size, 0);
  const sendLabel = describeSend({
    contactCount,
    cc: ccList.addresses,
    bcc: bccList.addresses,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ras-purple dark:text-white">
          Write an email
        </h2>
        {templates.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-ras-gray dark:text-white/70">
            Start from
            <select
              defaultValue=""
              onChange={(event) => loadTemplate(event.target.value)}
              className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-xs text-[var(--color-fg)]"
            >
              <option value="">a blank email</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div>
        <label htmlFor="compose-subject" className={LABEL}>
          Subject
        </label>
        <input
          id="compose-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="What this email is about"
          className={FIELD}
          aria-invalid={Boolean(result?.errors?.subject)}
        />
        {result?.errors?.subject ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {result.errors.subject}
          </p>
        ) : null}
      </div>

      <details open={Boolean(cc || bcc)}>
        <summary className={SUMMARY}>
          Copy someone in
          {ccList.addresses.length + bccList.addresses.length > 0
            ? ` · ${ccList.addresses.length + bccList.addresses.length}`
            : ""}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="compose-cc" className={LABEL}>
              Cc
            </label>
            <input
              id="compose-cc"
              value={cc}
              onChange={(event) => setCc(event.target.value)}
              placeholder="chair@example.com, advisor@example.com"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="compose-bcc" className={LABEL}>
              Bcc
            </label>
            <input
              id="compose-bcc"
              value={bcc}
              onChange={(event) => setBcc(event.target.value)}
              placeholder="archive@example.com"
              className={FIELD}
            />
          </div>
        </div>
        {/* The one thing about cc here that is not what people expect. */}
        <p className="mt-2 text-xs text-ras-gray dark:text-white/60">
          Everyone on the list gets their own private copy. Anyone here gets{" "}
          <strong>one</strong> copy of the same email — not one per contact.
        </p>
        {ccList.error ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {ccList.error}
          </p>
        ) : null}
        {bccList.error ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {bccList.error}
          </p>
        ) : null}
      </details>

      <div>
        <span className={LABEL}>Message</span>
        <div className="mt-1">
          <RichTextEditor
            name="bodyHtml"
            handleRef={editor}
            initialHtml={draft?.bodyHtml ?? ""}
            onChange={(value) => {
              bodyRef.current = value;
              setBody(value);
            }}
          />
        </div>
        {result?.errors?.body ? (
          <p role="alert" className="mt-1 text-xs text-accent">
            {result.errors.body}
          </p>
        ) : null}
      </div>

      <details open={buttons.length > 0}>
        <summary className={SUMMARY}>Buttons{buttons.length > 0 ? ` · ${buttons.length}` : ""}</summary>
        <div className="mt-2 space-y-2">
          {buttons.map((item, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                value={item.label}
                onChange={(event) =>
                  setButtons(buttons.map((b, i) => (i === index ? { ...b, label: event.target.value } : b)))
                }
                placeholder="Read the rulebook"
                aria-label={`Button ${index + 1} words`}
                className={FIELD}
              />
              <input
                value={item.href}
                onChange={(event) =>
                  setButtons(buttons.map((b, i) => (i === index ? { ...b, href: event.target.value } : b)))
                }
                placeholder="/rules  or  https://…"
                aria-label={`Button ${index + 1} link`}
                className={FIELD}
              />
              <button
                type="button"
                onClick={() => setButtons(buttons.filter((_, i) => i !== index))}
                className="rounded-md px-3 py-2 text-xs text-ras-gray hover:text-accent dark:text-white/70"
              >
                Remove
              </button>
            </div>
          ))}
          {buttons.length < MAX_BUTTONS ? (
            <Button
              type="button"
              variant="ghost"
              className="px-3 py-1 text-xs"
              onClick={() => setButtons([...buttons, { label: "", href: "" }])}
            >
              Add a button
            </Button>
          ) : (
            <p className="text-xs text-ras-gray dark:text-white/60">
              Three is the most an email can carry before none of them is the one to press.
            </p>
          )}
          {result?.errors?.buttons ? (
            <p role="alert" className="text-xs text-accent">
              {result.errors.buttons}
            </p>
          ) : null}
        </div>
      </details>

      <details>
        <summary className={SUMMARY}>Greeting, sign-off and footer</summary>
        <div className="mt-2 space-y-3">
          <div>
            <label htmlFor="compose-greeting" className={LABEL}>
              Greeting
            </label>
            <input
              id="compose-greeting"
              value={greeting}
              onChange={(event) => setGreeting(event.target.value)}
              className={FIELD}
            />
            <p className="mt-1 text-xs text-ras-gray dark:text-white/60">
              <code>{NAME_TOKEN}</code> becomes the person&apos;s own name. Somebody added as a bare
              address has none, and then it reads &ldquo;{applyGreeting(greeting) || "Hi,"}&rdquo;.
            </p>
          </div>
          <div>
            <label htmlFor="compose-signoff" className={LABEL}>
              Sign-off
            </label>
            <input
              id="compose-signoff"
              value={signOff}
              onChange={(event) => setSignOff(event.target.value)}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="compose-footer" className={LABEL}>
              Small print at the foot
            </label>
            <input
              id="compose-footer"
              value={footerNote}
              onChange={(event) => setFooterNote(event.target.value)}
              className={FIELD}
            />
          </div>
        </div>
      </details>

      <details open={attachments.length > 0}>
        <summary className={SUMMARY}>
          Attachments{attachments.length > 0 ? ` · ${attachments.length}` : ""}
        </summary>
        <div className="mt-2 space-y-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ras-gray/20 px-3 py-2 text-xs"
            >
              <span className="text-ras-gray dark:text-white/80">
                {file.filename}
                <span className="ml-2 text-ras-gray/70 dark:text-white/50">{formatBytes(file.size)}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const data = new FormData();
                    data.set("attachmentId", file.id);
                    data.set("listId", listId);
                    const outcome = await detachFile(data);
                    setResult(outcome);
                    if (outcome.ok) setAttachments(attachments.filter((a) => a.id !== file.id));
                  })
                }
                className="text-ras-gray hover:text-accent dark:text-white/70"
              >
                Remove
              </button>
            </div>
          ))}
          <input
            ref={fileInput}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file twice in a row still fires.
              event.target.value = "";
              if (file) upload(file);
            }}
            className="w-full rounded-md border border-ras-gray/30 bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-fg)] file:mr-3 file:rounded file:border-0 file:bg-ras-purple/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-ras-purple dark:file:bg-white/10 dark:file:text-white"
          />
          <p className="text-xs text-ras-gray dark:text-white/60">
            {ATTACHMENT_TYPE_SUMMARY}. {formatBytes(attachedBytes)} of{" "}
            {formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)} used.
          </p>
        </div>
      </details>

      <div>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs font-semibold uppercase tracking-wide text-ras-gray hover:text-ras-purple dark:text-white/60 dark:hover:text-white"
        >
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
        {showPreview ? (
          <div className="mt-2 overflow-x-auto rounded-md border border-ras-gray/25 p-4" style={{ backgroundColor: EMAIL_SURFACE }}>
            <div className="mx-auto max-w-[580px] rounded-lg bg-white p-6">
              {applyGreeting(greeting, "Hashem") ? (
                <p style={{ margin: "0 0 16px", color: EMAIL_GRAY, fontSize: 15 }}>
                  {applyGreeting(greeting, "Hashem")}
                </p>
              ) : null}
              {/*
                Drawn by the very module that will draw the email — see
                rich-text.ts.

                The list classes are not decoration: Tailwind's reset removes
                list markers document-wide, and a mail client applies no such
                reset, so without them the preview showed bulleted lists with no
                bullets — the one thing a preview must not do.
              */}
              <div
                className="[&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
              {buttons.filter((b) => b.label.trim()).length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {buttons
                    .filter((b) => b.label.trim())
                    .map((b, index) => (
                      <span
                        key={index}
                        style={{
                          display: "inline-block",
                          padding: "10px 24px",
                          backgroundColor: EMAIL_CRIMSON,
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: 13,
                          borderRadius: 999,
                        }}
                      >
                        {b.label}
                      </span>
                    ))}
                </div>
              ) : null}
              {signOff ? (
                <p style={{ margin: "24px 0 0", color: EMAIL_GRAY, fontSize: 15 }}>{signOff}</p>
              ) : null}
              {footerNote ? (
                <p style={{ margin: "24px 0 0", color: EMAIL_GRAY, fontSize: 12 }}>{footerNote}</p>
              ) : null}
            </div>
            <p className="mx-auto mt-3 max-w-[580px] text-xs text-ras-gray">
              The MMRC header and footer wrap this. To see the real thing, send yourself a test.
            </p>
          </div>
        ) : null}
      </div>

      {progress ? (
        <div className="rounded-md border border-ras-purple/25 bg-ras-purple/5 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-ras-purple dark:text-white">
              {progress.done ? "Finished" : `Sending to ${listName}`}
            </span>
            <span className="text-ras-gray dark:text-white/70">
              {progress.sent + progress.failed} of {progress.total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress.sent + progress.failed}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ras-purple/15"
          >
            <div
              className="h-full rounded-full bg-ras-purple transition-[width] duration-300 dark:bg-accent"
              style={{
                width: `${progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 100}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ras-gray dark:text-white/70">
            {progress.sent} sent
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ""}
            {progress.done ? "" : " · safe to leave this page, it resumes where it stopped"}
          </p>
        </div>
      ) : null}

      {result?.message ? (
        <p
          role="status"
          data-testid="composer-notice"
          className={`rounded-md px-3 py-2 text-sm ${
            result.ok
              ? "bg-ras-purple/10 text-ras-purple dark:bg-white/10 dark:text-white"
              : "bg-ras-crimson/10 text-accent"
          }`}
        >
          {result.message}
        </p>
      ) : null}
      {result?.errors?.recipients ? (
        <p role="alert" className="text-sm text-accent">
          {result.errors.recipients}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-ras-gray/20 pt-4">
        <Button type="button" disabled={pending} onClick={send}>
          {pending && progress && !progress.done ? "Sending…" : sendLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="px-3 py-1 text-xs"
          onClick={() => run(saveDraft)}
        >
          Save draft
        </Button>
        {draftId ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="px-3 py-1 text-xs text-accent"
            onClick={() =>
              startTransition(async () => {
                const data = new FormData();
                data.set("draftId", draftId);
                data.set("listId", listId);
                const outcome = await discardDraft(data);
                setResult(outcome);
                if (outcome.ok) window.location.reload();
              })
            }
          >
            Discard draft
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="compose-test" className={LABEL}>
              Send a test to
            </label>
            <input
              id="compose-test"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
              className={FIELD}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="px-3 py-2 text-xs"
            onClick={() => run(sendTest)}
          >
            Send test
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="compose-template" className={LABEL}>
              Save as a template called
            </label>
            <input
              id="compose-template"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Week-before reminder"
              className={FIELD}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            className="px-3 py-2 text-xs"
            onClick={() => run(saveAsTemplate)}
          >
            Save template
          </Button>
        </div>
      </div>
    </div>
  );
}
