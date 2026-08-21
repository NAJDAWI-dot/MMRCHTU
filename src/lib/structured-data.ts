/**
 * schema.org descriptions of the site, for search engines.
 *
 * A search result for "MMRC" is currently a blue link and a snippet. With this,
 * Google can show the date and the venue directly — which is the whole reason
 * most people search for a competition in the first place.
 *
 * Pure functions returning plain objects, so the shapes can be asserted in
 * tests rather than eyeballed in a rendered page.
 */

import { absoluteUrl, siteOrigin } from "@/lib/site-url";

const ORGANIZER = {
  "@type": "Organization",
  name: "IEEE RAS HTU Student Chapter",
  url: siteOrigin,
} as const;

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORGANIZER.name,
    alternateName: "IEEE Robotics & Automation Society, HTU Student Chapter",
    url: siteOrigin(),
    logo: absoluteUrl("/brand/favicon/apple-touch-icon.png"),
  };
}

export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MMRC 26",
    url: siteOrigin(),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/search?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface EventJsonLdInput {
  name: string;
  description: string;
  /** When it starts. Omitted from the output when unknown. */
  startDate: Date | null;
  /** Free-text venue. Omitted when blank. */
  venue: string;
}

/**
 * The competition itself.
 *
 * `startDate` and `location` are left out entirely rather than emitted empty:
 * Google treats a malformed Event as an error and drops the whole block, so a
 * partial-but-valid description is worth more than a complete-looking one.
 */
export function eventJsonLd(input: EventJsonLdInput): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.name,
    description: input.description,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url: absoluteUrl("/competition-day"),
    organizer: {
      "@type": "Organization",
      name: ORGANIZER.name,
      url: siteOrigin(),
    },
    image: absoluteUrl("/opengraph-image"),
  };

  if (input.startDate) data.startDate = input.startDate.toISOString();
  if (input.venue.trim()) {
    data.location = {
      "@type": "Place",
      name: input.venue,
      address: { "@type": "PostalAddress", addressCountry: "JO" },
    };
  }

  return data;
}
