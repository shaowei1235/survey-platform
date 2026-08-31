import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));

const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  outputFileTracingRoot: dir,
  turbopack: { root: dir },
  basePath,
  skipTrailingSlashRedirect: true,
  // Hide the Next.js "N" badge (dev only; production never shows it)
  devIndicators: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
  },
};

export default nextConfig;
