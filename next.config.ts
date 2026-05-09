import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Type errors are caught by tsc; don't block dev builds
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
