import type { NextConfig } from "next";

/**
 * Allow the optimizer to fetch from whatever origin serves the images.
 *
 * Derived from the same variable the renderer uses rather than hardcoded, so
 * moving buckets is a deployment change and not a code change. Empty in
 * development, where images come from the local `/api/media` route and need no
 * allowlisting.
 */
function imageOrigins() {
  const base = process.env.NEXT_PUBLIC_IMAGE_BASE_URL;
  if (!base) return [];

  try {
    const { protocol, hostname, port, pathname } = new URL(base);
    return [
      {
        protocol: protocol.replace(":", "") as "http" | "https",
        hostname,
        port,
        pathname: `${pathname.replace(/\/+$/, "")}/**`,
      },
    ];
  } catch {
    // A malformed value fails loudly in the env schema; don't also break here.
    return [];
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  images: {
    remotePatterns: imageOrigins(),
  },
};

export default nextConfig;
