import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // next dev refuses cross-origin requests to its HMR/asset endpoints by
  // default; 127.0.0.1 is how Playwright's e2e suite (and this sandbox)
  // address the dev server, which otherwise trips that guard.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The dev-mode build-activity badge sits bottom-left, right on top of
  // this dashboard's own bottom-left junction-info card, off in the
  // static-exported production build regardless, but also off in dev so
  // it doesn't get mistaken for a real overlapping-UI bug in screenshots.
  devIndicators: false,
};

export default nextConfig;
