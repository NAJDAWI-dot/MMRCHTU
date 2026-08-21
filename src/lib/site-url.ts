/**
 * The site's canonical absolute origin.
 *
 * Distinct from the request-derived helper in `email.ts`, and deliberately so:
 * that one answers "what host did this visitor arrive on", which is right for
 * a link in an email triggered by their action. This one answers "what is the
 * site's address", which has to work with no request at all — the sitemap, the
 * robots file and the Open Graph metadata are all built without one.
 *
 * Never ends in a slash, so callers can append a path without doubling it.
 */
export function siteOrigin(): string {
  const explicit = process.env.SITE_URL;
  if (explicit) return normalise(explicit);

  // Vercel's stable production domain — the one worth putting in a sitemap.
  // Set on every deployment, including previews, and always points at prod.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return normalise(production);

  // The per-deployment URL. A preview build has no better answer, and using it
  // at least keeps generated links pointing at the deployment being viewed.
  const deployment = process.env.VERCEL_URL;
  if (deployment) return normalise(deployment);

  return "http://localhost:3000";
}

/** Adds a scheme when the value is a bare host, and trims any trailing slash. */
function normalise(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
