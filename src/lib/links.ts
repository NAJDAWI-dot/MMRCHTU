/**
 * Turning something an admin typed into a link the site is willing to publish.
 *
 * The threat is not the admin. It is a stolen admin session, and a text box
 * whose contents become an `href` on a public page is the cheapest way to put
 * `javascript:` in front of every visitor. Parsing with `URL` and allowing two
 * schemes is the whole defence, and it lives in one function so the map link,
 * the reference links and whatever comes next cannot drift apart.
 *
 * Typing "ukmars.org" into a box labelled Link is what people do, so a bare
 * host is promoted to https rather than rejected.
 */
export function externalUrl(value: string | null | undefined, maxLength: number): string {
  let raw = String(value ?? "").trim();
  if (!raw || raw.length > maxLength) return "";

  if (!raw.includes("://") && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * The bit of a URL worth showing a reader: the host, without the www.
 *
 * Printed on link cards so somebody can see they are about to leave for
 * github.com before they click, which is the thing a title alone never says.
 */
export function hostLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
