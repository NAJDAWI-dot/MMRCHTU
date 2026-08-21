import type { MetadataRoute } from "next";
import { absoluteUrl, siteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
        The admin area already requires a session, so this is not what protects
        it — it keeps the pages out of search results and stops crawlers
        burning the site's request budget on a login redirect. /api is excluded
        for the same reason: none of it is a page, and the ICS route generates
        a file per schedule event.
      */
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteOrigin(),
  };
}
