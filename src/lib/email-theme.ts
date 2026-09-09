/**
 * The colours outgoing email is drawn in.
 *
 * Split out of email-templates.ts because that module reaches for node:fs to
 * check which logo files exist, which makes it server-only — and the rich text
 * renderer needs these same values while staying importable by the browser, so
 * the admin's preview is drawn by the very code that will draw the email.
 *
 * Hex rather than the site's CSS custom properties on purpose: mail clients
 * have no custom properties, and half of them strip <style> blocks, so every
 * colour in an email is written inline as a literal.
 */
export const EMAIL_PURPLE = "#5F2167";
export const EMAIL_PURPLE_DEEP = "#3F1546";
export const EMAIL_CRIMSON = "#862633";
export const EMAIL_GOLD = "#F2A900";
export const EMAIL_GRAY = "#57565B";
export const EMAIL_BORDER = "#e3dde5";
export const EMAIL_SURFACE = "#f7f5f8";
export const EMAIL_INK = "#1a1a1a";
