/**
 * Turns what a rich text editor produced into the HTML an email can carry.
 *
 * Not a sanitiser bolted onto a pass-through, and the difference matters. The
 * input is parsed into a tree, and the output is then *written from scratch*
 * out of a fixed set of tags with the email palette inlined on every one. So
 * the tags in an outgoing email are ours whatever the editor emitted, which
 * buys two things at once:
 *
 *  - Safety. Nothing survives that is not on the list below: no script, no
 *    style, no event handler, no javascript: href, no attribute this file did
 *    not write itself. The author is a signed-in admin, but their draft is also
 *    rendered as a live preview inside their own admin session, and a
 *    contenteditable will happily accept anything pasted from another page.
 *
 *  - Mail clients. A browser's contenteditable produces <div>s and
 *    <span style="font-weight:700">, and Outlook renders that as a wall of
 *    unstyled text. Rewriting into <p>/<strong> with inline styles is the only
 *    form that survives the trip.
 *
 * Free of React, Prisma, the DOM and node — the admin's preview and the send
 * path both call it, so it has to run in both places, and so it can be tested
 * on its own.
 */

import { EMAIL_GRAY, EMAIL_INK, EMAIL_PURPLE, EMAIL_SURFACE } from "@/lib/email-theme";

/** A pathological paste should not be able to occupy the parser indefinitely. */
export const MAX_RICH_TEXT_LENGTH = 100_000;

/*
  The whole vocabulary. Everything else is either dropped outright (script,
  style) or made transparent — the tag disappears and its text is kept, which is
  what you want for the <div>s and <span>s an editor wraps things in.
*/
const BLOCK_TAGS = ["p", "h2", "h3", "ul", "ol", "li", "blockquote"] as const;
const INLINE_TAGS = ["strong", "em", "u", "s", "a", "br"] as const;

type BlockTag = (typeof BLOCK_TAGS)[number];
type InlineTag = (typeof INLINE_TAGS)[number];
type Tag = BlockTag | InlineTag;

/**
 * What the editor may emit, mapped onto what we keep.
 *
 * A div becomes a paragraph because that is what a contenteditable uses for a
 * new line; headings collapse to two levels because an email has no use for
 * six; and the presentational tags every editor still emits map onto their
 * semantic equivalents rather than being thrown away.
 */
const TAG_ALIASES: Record<string, Tag> = {
  b: "strong",
  strong: "strong",
  i: "em",
  em: "em",
  u: "u",
  ins: "u",
  s: "s",
  strike: "s",
  del: "s",
  a: "a",
  br: "br",
  p: "p",
  div: "p",
  h1: "h2",
  h2: "h2",
  h3: "h3",
  h4: "h3",
  h5: "h3",
  h6: "h3",
  ul: "ul",
  ol: "ol",
  li: "li",
  blockquote: "blockquote",
};

/** Dropped with their contents, rather than made transparent. */
const DROPPED_WHOLE = new Set([
  "script",
  "style",
  "head",
  "title",
  "noscript",
  "iframe",
  "object",
  "template",
]);

const SELF_CLOSING = new Set(["br", "img", "hr", "input", "meta", "link", "source"]);

const BLOCK_SET = new Set<string>(BLOCK_TAGS);

const STYLES: Record<Tag, string> = {
  p: `margin:0 0 16px; color:${EMAIL_INK}; font-size:15px; line-height:1.6;`,
  h2: `margin:24px 0 12px; color:${EMAIL_PURPLE}; font-size:19px; font-weight:bold; line-height:1.3;`,
  h3: `margin:20px 0 10px; color:${EMAIL_PURPLE}; font-size:16px; font-weight:bold; line-height:1.4;`,
  ul: `margin:0 0 16px; padding-left:22px; color:${EMAIL_INK}; font-size:15px; line-height:1.6;`,
  ol: `margin:0 0 16px; padding-left:22px; color:${EMAIL_INK}; font-size:15px; line-height:1.6;`,
  li: "margin:0 0 6px;",
  blockquote: `margin:0 0 16px; padding:12px 16px; background-color:${EMAIL_SURFACE}; border-left:3px solid ${EMAIL_PURPLE}; color:${EMAIL_GRAY}; font-size:15px; line-height:1.6;`,
  a: `color:${EMAIL_PURPLE}; text-decoration:underline;`,
  strong: "",
  em: "",
  u: "",
  s: "",
  br: "",
};

interface TextNode {
  type: "text";
  value: string;
}

interface ElementNode {
  type: "element";
  tag: Tag;
  href?: string;
  children: Node[];
}

type Node = TextNode | ElementNode;

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/**
 * Entities back to characters, so the text rendition reads as words rather than
 * as markup, and so escapeHtml on the way out works from the real characters
 * instead of double-escaping what it finds.
 */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * The one attribute that survives, and only when it points somewhere a mail
 * client will actually follow.
 *
 * Everything else — every style, class, id, onclick — is not filtered so much
 * as never read: the writer below emits attributes from this file's own strings
 * and never from the input.
 */
export function safeHref(raw: string): string | null {
  // Control characters and whitespace go first, because "java\nscript:alert()"
  // is a real evasion and every browser reads it as a scheme.
  const cleaned = decodeEntities(raw).replace(/[\u0000-\u0020\u007f]/g, "");
  if (!cleaned) return null;
  if (/^(https?:\/\/|mailto:)/i.test(cleaned)) return cleaned;
  // A bare site path is the common case when an admin links their own pages.
  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) return cleaned;
  return null;
}

function readHref(raw: string): string | undefined {
  const match = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(raw);
  if (!match) return undefined;
  const href = safeHref(match[2] ?? match[3] ?? match[4] ?? "");
  return href ?? undefined;
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (predicate(items[i]!)) return i;
  }
  return -1;
}

/**
 * Input to a tree of the tags above.
 *
 * Unknown tags are transparent rather than an error: their children are hoisted
 * into the parent, which is what makes a paste out of a word processor — nested
 * five spans deep — come out as readable text instead of nothing at all.
 */
function parse(input: string): Node[] {
  const root: ElementNode = { type: "element", tag: "p", children: [] };
  const stack: ElementNode[] = [root];
  // Transparent tags are still counted, so their closing tag cannot close
  // somebody else's element.
  const open: { name: string; kept: boolean }[] = [];
  let index = 0;

  const top = (): ElementNode => stack[stack.length - 1]!;

  const pushText = (value: string) => {
    if (!value) return;
    const parent = top();
    const last = parent.children[parent.children.length - 1];
    if (last && last.type === "text") last.value += value;
    else parent.children.push({ type: "text", value });
  };

  const closeTo = (at: number) => {
    for (let i = open.length - 1; i >= at; i -= 1) {
      if (open[i]!.kept) stack.pop();
      open.pop();
    }
  };

  while (index < input.length) {
    const lt = input.indexOf("<", index);
    if (lt === -1) {
      pushText(decodeEntities(input.slice(index)));
      break;
    }
    if (lt > index) pushText(decodeEntities(input.slice(index, lt)));

    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt);
      index = end === -1 ? input.length : end + 3;
      continue;
    }

    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      // An unterminated "<" is text, not a tag. Losing the rest of an email
      // because somebody typed "5 < 6" would be worse than showing it.
      pushText(decodeEntities(input.slice(lt)));
      break;
    }

    const raw = input.slice(lt + 1, gt);
    index = gt + 1;
    if (!raw || raw.startsWith("!") || raw.startsWith("?")) continue;

    const closing = raw.startsWith("/");
    const nameMatch = /^\/?\s*([a-z][a-z0-9]*)/i.exec(raw);
    if (!nameMatch) {
      // Not a tag, so it is what somebody typed: "wall height is < 6cm". The
      // scan for ">" ran on to the next real tag, which means dropping this
      // would take the rest of the sentence with it.
      pushText(decodeEntities(input.slice(lt, gt + 1)));
      continue;
    }
    const name = nameMatch[1]!.toLowerCase();

    if (DROPPED_WHOLE.has(name)) {
      if (!closing) {
        // Skip to the matching close so the contents go with it. Anything
        // unterminated takes the rest of the input with it, which is the safe
        // direction to fail.
        const close = input.toLowerCase().indexOf(`</${name}`, index);
        index = close === -1 ? input.length : close;
      }
      continue;
    }

    if (closing) {
      const at = findLastIndex(open, (entry) => entry.name === name);
      if (at !== -1) closeTo(at);
      continue;
    }

    const tag = TAG_ALIASES[name];
    if (!tag) {
      if (!SELF_CLOSING.has(name) && !raw.trimEnd().endsWith("/")) {
        open.push({ name, kept: false });
      }
      continue;
    }

    if (tag === "br") {
      top().children.push({ type: "element", tag: "br", children: [] });
      continue;
    }

    /*
      A block cannot live inside a paragraph, and an editor produces that
      constantly — a div inside a div for every new line. Closing the open
      paragraph first is what a browser does with the same markup, and without
      it a long email nests one paragraph inside the last until the indentation
      walks off the right of the screen.
    */
    if (BLOCK_SET.has(tag) && tag !== "li") {
      const at = findLastIndex(open, (entry) => entry.kept);
      if (at !== -1 && open[at]!.name === "p") closeTo(at);
      else if (at !== -1 && open[at]!.name === "div") closeTo(at);
    }

    const element: ElementNode = { type: "element", tag, children: [] };
    if (tag === "a") {
      const href = readHref(raw);
      if (href) element.href = href;
    }
    top().children.push(element);

    if (raw.trimEnd().endsWith("/")) continue;
    stack.push(element);
    open.push({ name, kept: true });
  }

  return root.children;
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Whether there are words here, which a line break is not.
 *
 * An editor writes an empty line as <p><br></p>, and counting that as content
 * would both keep the blank paragraph in the email and let somebody "send" a
 * message with nothing written in it.
 */
function hasWords(nodes: readonly Node[]): boolean {
  return nodes.some((node) =>
    node.type === "text" ? node.value.trim().length > 0 : hasWords(node.children),
  );
}

/**
 * Where the writer is standing.
 *
 * "block" is between paragraphs, where a run of bare text has to become one.
 * "inline" is inside a paragraph or heading, where that same text is already in
 * one and wrapping it again produces a paragraph nested in a paragraph — which
 * is what the first version of this did, on every line of every email. "list"
 * is inside a ul or ol, where the only legal child is an item.
 */
type Mode = "block" | "inline" | "list";

function renderNodes(nodes: readonly Node[], mode: Mode): string {
  let out = "";
  let loose = "";

  const flushLoose = () => {
    const content = loose.trim();
    loose = "";
    if (!content) return;
    // A bare first line — which an editor emits before Enter is ever pressed —
    // becomes a paragraph, so the email's spacing stays even instead of leaving
    // one line hard against the next. Inside a list it becomes an item, because
    // loose text between <li>s renders nowhere in half the mail clients.
    if (mode === "block") out += `<p style="${STYLES.p}">${content}</p>`;
    else if (mode === "list") out += `<li style="${STYLES.li}">${content}</li>`;
    else out += content;
  };

  for (const node of nodes) {
    if (node.type === "text") {
      loose += escapeHtml(node.value);
      continue;
    }
    if (node.tag === "br") {
      loose += "<br />";
      continue;
    }
    if (BLOCK_SET.has(node.tag)) {
      // A block that cannot legally sit here contributes its words and not its
      // tag — better a flat sentence than markup a mail client gives up on.
      if (mode === "inline") {
        loose += renderNodes(node.children, "inline");
        continue;
      }
      if (mode === "list" && node.tag !== "li") {
        flushLoose();
        out += renderNodes(node.children, "list");
        continue;
      }
      flushLoose();
      if (!hasWords(node.children)) continue;
      const style = STYLES[node.tag];
      const inner = node.tag === "ul" || node.tag === "ol" ? "list" : "inline";
      out += `<${node.tag}${style ? ` style="${style}"` : ""}>${renderNodes(node.children, inner)}</${node.tag}>`;
      continue;
    }
    if (node.tag === "a") {
      const inner = renderNodes(node.children, "inline");
      if (!node.href) {
        // A link we will not follow keeps its words. Dropping the text along
        // with the href would silently delete a sentence from the middle of an
        // email, which is far worse than an unlinked phrase.
        loose += inner;
        continue;
      }
      loose += `<a href="${escapeHtml(node.href)}" style="${STYLES.a}">${inner || escapeHtml(node.href)}</a>`;
      continue;
    }
    loose += `<${node.tag}>${renderNodes(node.children, "inline")}</${node.tag}>`;
  }

  flushLoose();
  return out;
}

function renderText(nodes: readonly Node[], out: string[]): void {
  for (const node of nodes) {
    if (node.type === "text") {
      out.push(node.value.replace(/\s+/g, " "));
      continue;
    }
    switch (node.tag) {
      case "br":
        out.push("\n");
        break;
      case "li":
        out.push("\n- ");
        renderText(node.children, out);
        break;
      case "p":
      case "h2":
      case "h3":
      case "blockquote":
      case "ul":
      case "ol":
        out.push("\n\n");
        renderText(node.children, out);
        out.push("\n");
        break;
      case "a":
        renderText(node.children, out);
        // The address itself, because a text-only client shows no link at all
        // and the reader is otherwise told to click nothing.
        if (node.href) out.push(` (${node.href})`);
        break;
      default:
        renderText(node.children, out);
    }
  }
}

export interface RichText {
  /** Inline-styled HTML, safe to drop into an email or into a preview. */
  html: string;
  /** The same words as plain text, for the multipart alternative. */
  text: string;
  /** False when the input carries no words at all — only empty markup. */
  hasContent: boolean;
}

export function renderRichText(input: string | null | undefined): RichText {
  const tree = parse((input ?? "").slice(0, MAX_RICH_TEXT_LENGTH));
  const parts: string[] = [];
  renderText(tree, parts);
  const text = parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { html: renderNodes(tree, "block"), text, hasContent: hasWords(tree) };
}

/**
 * A short, tag-free opening for the preheader — the grey line a mail client
 * shows beside the subject in the inbox.
 */
export function richTextSummary(input: string | null | undefined, length = 140): string {
  const flat = renderRichText(input).text.replace(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length - 1).trimEnd()}…`;
}
