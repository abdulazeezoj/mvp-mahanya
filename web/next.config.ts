import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // next dev refuses cross-origin requests to its HMR/asset endpoints by
  // default; 127.0.0.1 is how Playwright's e2e suite (and this sandbox)
  // address the dev server, which otherwise trips that guard.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
