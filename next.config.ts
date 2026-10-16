import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `pg` is a native CommonJS driver, so keep it out of the bundler and load it
   * from node_modules at runtime. If the `.next/node_modules/pg-<hash>` symlink
   * ever breaks (copying from Windows, shipping `.next` without `node_modules`,
   * or reinstalling deps after a build) the server dies with ERR_MODULE_NOT_FOUND.
   * Cure: clean rebuild — rm -rf .next node_modules && npm install && npm run build
   */
  serverExternalPackages: ["pg"],

  // Smaller responses + no version fingerprint in headers.
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Baseline security headers for the whole panel.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Note: X-Frame-Options is intentionally omitted — the panel is
          // embedded in a cross-site preview iframe, which SAMEORIGIN breaks.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // Never cache API responses — all panel data is live.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
