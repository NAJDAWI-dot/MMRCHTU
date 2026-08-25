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
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
