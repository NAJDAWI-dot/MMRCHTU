import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "mdx"],
  experimental: {
    mdxRs: true,
    // Server Actions default to a 1 MB body, which is below the 4 MB
    // MAX_UPLOAD_BYTES the gallery uploader and the payment-proof upload both
    // advertise — an image between those two limits would be rejected by the
    // framework with an error neither form's validation could explain. Set
    // above the app's own ceiling so `checkUpload` stays the thing that decides.
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // Gallery photos live in Vercel Blob, which serves each store from its own
    // subdomain. Restricted to that host rather than left open, so the image
    // optimiser can never be aimed at an arbitrary URL.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },

  /**
   * Response headers the site had none of.
   *
   * No Content-Security-Policy here yet, deliberately. A CSP tight enough to be
   * worth having has to account for the inline splash script, Next's own
   * hydration payload, the canvas games and the blob image host, and a
   * directive one shade too narrow renders a blank page rather than an error.
   * It wants its own deploy, in report-only first. These four have no such
   * failure mode.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The admin screens act on a single click — a status dropdown, a
          // delete button — so a page that can frame them can trick a
          // signed-in admin into those clicks. Nothing here is ever meant to
          // be embedded, so this is denied outright rather than same-origin.
          { key: "X-Frame-Options", value: "DENY" },
          // Full URLs stop leaving the site. The registration resume link
          // carries a code in its query string, and the export feed carries a
          // token in its own — neither belongs in another origin's logs.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Already set by hand on the two routes that serve uploaded bytes;
          // this makes it the default everywhere rather than something each
          // new route has to remember.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The site asks for none of these, so nothing embedded in a page can
          // ask on its behalf.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
