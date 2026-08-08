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
  /**
   * Build output directory, overridable by environment.
   *
   * The browser tests build and serve the app themselves, and a build writes
   * over whatever `.next` holds — which, underneath a running `next dev`,
   * leaves that server handing out a bundle that renders but never hydrates.
   * Pointing the test build at its own directory means the two can run at once
   * without either noticing the other.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /* config options here */
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  images: {
    remotePatterns: imageOrigins(),
  },
};

export default nextConfig;
