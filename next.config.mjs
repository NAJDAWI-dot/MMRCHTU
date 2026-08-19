import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  pageExtensions: ["ts", "tsx", "mdx"],
  experimental: {
    mdxRs: true,
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
