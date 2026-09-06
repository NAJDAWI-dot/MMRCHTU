/**
 * Brand constants that more than one place has to agree on.
 *
 * Free of React and of Node, so the site's components and the server-only
 * email templates can both import it without dragging one another in.
 */

/**
 * The ground the MMRC 26 mark is drawn on.
 *
 * The supplied artwork is one maze glyph split down the middle, the left half
 * white and the right half black. That split only resolves over a mid-tone: on
 * this site's cream the white half disappears, on the dark theme the black half
 * would, and on an email's white band the white half goes again. Both approved
 * backgrounds in the source file are mid-tones, which is the design saying what
 * it needs.
 *
 * This is a tint of the brand purple chosen to behave the way the designer's
 * own grey does — black assertive at about 11:1, white a deliberate ghost at
 * about 1.9:1 — so the mark reads exactly as drawn without anybody recolouring
 * somebody else's logo.
 */
export const MMRC_PLATE = "#cdb2d1";
