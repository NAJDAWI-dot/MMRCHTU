"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { renderRichText } from "@/lib/rich-text";

/**
 * A small formatting editor, built on contenteditable and document.execCommand.
 *
 * execCommand is deprecated and has been for years, and is still implemented by
 * every browser there is — no replacement was ever shipped. The alternative is
 * a forty-kilobyte editor dependency in a repo that has deliberately declined
 * framer-motion and gsap for the same reason, to do a job that is four buttons
 * and a link box. Its famously messy output is not a problem here, because
 * nothing it produces is ever sent: src/lib/rich-text.ts reads it and writes
 * the email itself out of a fixed set of tags.
 *
 * Uncontrolled on purpose. A controlled contenteditable has to put the caret
 * back after every keystroke, and gets it wrong the moment anything else
 * re-renders — the classic "typing backwards" bug. The DOM holds the value and
 * a hidden input mirrors it for the form.
 */

/** What the page can do to the editor from outside it. */
export interface EditorHandle {
  /** Replaces what is being edited — used when starting from a template. */
  setContent(html: string): void;
}

interface ToolbarButton {
  /** execCommand name, or a block tag for formatBlock. */
  command: string;
  argument?: string;
  label: string;
  /** What is drawn on the button. */
  glyph: React.ReactNode;
  /** Whether the button lights up when the caret is inside this formatting. */
  stateful?: boolean;
}

const TOOLS: readonly (ToolbarButton | "divider")[] = [
  { command: "bold", label: "Bold", glyph: <span className="font-bold">B</span>, stateful: true },
  { command: "italic", label: "Italic", glyph: <span className="font-serif italic">I</span>, stateful: true },
  {
    command: "underline",
    label: "Underline",
    glyph: <span className="underline">U</span>,
    stateful: true,
  },
  "divider",
  {
    command: "formatBlock",
    argument: "h2",
    label: "Heading",
    glyph: <span className="font-bold">H</span>,
  },
  {
    command: "insertUnorderedList",
    label: "Bulleted list",
    glyph: <span aria-hidden="true">•—</span>,
    stateful: true,
  },
  {
    command: "insertOrderedList",
    label: "Numbered list",
    glyph: <span aria-hidden="true">1.</span>,
    stateful: true,
  },
  {
    command: "formatBlock",
    argument: "blockquote",
    label: "Quote",
    glyph: <span aria-hidden="true">&ldquo;</span>,
  },
  "divider",
  { command: "removeFormat", label: "Clear formatting", glyph: <span aria-hidden="true">Tx</span> },
  { command: "undo", label: "Undo", glyph: <span aria-hidden="true">&#8630;</span> },
  { command: "redo", label: "Redo", glyph: <span aria-hidden="true">&#8631;</span> },
];

const TOOL_CLASS =
  "grid h-8 min-w-[2rem] place-items-center rounded px-2 text-sm text-ras-gray transition-colors hover:bg-ras-purple/10 hover:text-ras-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ras-purple/40 dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white";

export function RichTextEditor({
  name,
  initialHtml,
  onChange,
  handleRef,
  ariaLabel = "Message",
}: {
  name: string;
  initialHtml: string;
  onChange?: (html: string) => void;
  /** Lets the page replace what is being edited — see EditorHandle. */
  handleRef?: MutableRefObject<EditorHandle | null>;
  ariaLabel?: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState(initialHtml);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [active, setActive] = useState<Record<string, boolean>>({});
  // Where the caret was before focus moved to the link box. Without this,
  // createLink has no selection to work on and silently does nothing.
  const savedRange = useRef<Range | null>(null);

  const publish = useCallback(() => {
    const value = editorRef.current?.innerHTML ?? "";
    setHtml(value);
    onChange?.(value);
  }, [onChange]);

  /**
   * The content is put into the DOM by hand, once, and React is never told
   * about it.
   *
   * It used to arrive through dangerouslySetInnerHTML, which cost the editor
   * the ability to be typed in at all: React owns the children of an element it
   * renders that way, so every re-render — and there is one per keystroke,
   * because the preview updates as you type — wrote the original content back
   * over whatever had just been typed. Measured, it replaced all three child
   * nodes three times for a single character.
   *
   * With no children in the JSX there is nothing for React to restore, and the
   * browser's own editing is the only thing that ever touches them.
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) editor.innerHTML = renderRichText(initialHtml).html;
    // Deliberately on mount alone. Re-running this when initialHtml changed
    // would move the caret to the start mid-sentence; replacing the content
    // deliberately is what the handle below is for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // New lines become <p> rather than <div>. Both are handled downstream, but
    // paragraphs are what the email actually wants and what the editor should
    // show while it is being written.
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Firefox throws on unknown commands; the fallback is <div>, which
      // rich-text.ts maps to a paragraph anyway.
    }
  }, []);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      setContent(next: string) {
        const editor = editorRef.current;
        if (!editor) return;
        editor.innerHTML = renderRichText(next).html;
        publish();
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, publish]);

  const refreshActive = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const tool of TOOLS) {
      if (tool === "divider" || !tool.stateful) continue;
      try {
        next[tool.command] = document.queryCommandState(tool.command);
      } catch {
        next[tool.command] = false;
      }
    }
    setActive(next);
  }, []);

  function run(tool: ToolbarButton) {
    editorRef.current?.focus();
    if (tool.command === "formatBlock") {
      const tag = tool.argument ?? "p";
      // Pressing Heading on a line that is already a heading turns it back into
      // a paragraph, so the button is a toggle rather than a one-way trip.
      const current = document.queryCommandValue("formatBlock").toLowerCase();
      document.execCommand("formatBlock", false, current === tag ? "p" : tag);
    } else {
      document.execCommand(tool.command, false, tool.argument);
    }
    publish();
    refreshActive();
  }

  function openLink() {
    const selection = window.getSelection();
    savedRange.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    setLinkValue("");
    setLinkOpen(true);
  }

  function applyLink() {
    const href = linkValue.trim();
    const range = savedRange.current;
    setLinkOpen(false);
    if (!href || !range) return;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorRef.current?.focus();

    if (range.collapsed) {
      // Nothing was selected, so there is nothing to make into a link. Insert
      // the address as its own text and link that, rather than doing nothing
      // and leaving the admin wondering which of the two happened.
      document.execCommand("insertHTML", false, `<a href="${href.replace(/"/g, "&quot;")}">${href}</a>`);
    } else {
      document.execCommand("createLink", false, href);
    }
    publish();
  }

  function removeLink() {
    editorRef.current?.focus();
    document.execCommand("unlink");
    publish();
  }

  return (
    <div className="rounded-md border border-ras-gray/30 bg-[var(--color-bg)]">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 border-b border-ras-gray/20 px-1.5 py-1.5"
      >
        {TOOLS.map((tool, index) =>
          tool === "divider" ? (
            <span
              key={`divider-${index}`}
              aria-hidden="true"
              className="mx-1 h-5 w-px bg-ras-gray/25 dark:bg-white/20"
            />
          ) : (
            <button
              key={`${tool.command}-${tool.argument ?? ""}`}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.stateful ? Boolean(active[tool.command]) : undefined}
              // The editor must not lose the selection when a button is pressed,
              // and mousedown is what takes it away.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(tool)}
              className={`${TOOL_CLASS} ${
                tool.stateful && active[tool.command] ? "bg-ras-purple/15 text-ras-purple dark:bg-white/15 dark:text-white" : ""
              }`}
            >
              {tool.glyph}
            </button>
          ),
        )}
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-ras-gray/25 dark:bg-white/20" />
        <button
          type="button"
          title="Add a link"
          aria-label="Add a link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openLink}
          className={TOOL_CLASS}
        >
          <span aria-hidden="true">Link</span>
        </button>
        <button
          type="button"
          title="Remove the link"
          aria-label="Remove the link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={removeLink}
          className={TOOL_CLASS}
        >
          <span aria-hidden="true">Unlink</span>
        </button>
      </div>

      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-ras-gray/20 bg-[var(--color-surface)] px-2 py-2">
          <input
            autoFocus
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
            placeholder="https://mmrchtu.tech/rules  or  /rules"
            aria-label="Link address"
            className="min-w-0 flex-1 rounded border border-ras-gray/30 bg-[var(--color-bg)] px-2 py-1 text-sm text-[var(--color-fg)]"
          />
          <button
            type="button"
            onClick={applyLink}
            className="rounded bg-ras-purple px-3 py-1 text-xs font-semibold text-white"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="rounded px-2 py-1 text-xs text-ras-gray dark:text-white/70"
          >
            Cancel
          </button>
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        onInput={publish}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onBlur={publish}
        className="min-h-[16rem] max-w-none px-4 py-3 text-sm leading-relaxed text-[var(--color-fg)] focus:outline-none [&_a]:text-ras-purple [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-ras-purple/40 [&_blockquote]:pl-3 [&_blockquote]:text-ras-gray [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ras-purple [&_li]:ml-5 [&_li]:list-item [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc dark:[&_a]:text-white dark:[&_blockquote]:text-white/70 dark:[&_h2]:text-white"
      />

      <input type="hidden" name={name} value={html} />
    </div>
  );
}
