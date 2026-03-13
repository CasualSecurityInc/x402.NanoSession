import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [
    "@nanosession/core",
    "@nanosession/rpc",
    "@nanosession/facilitator",
    "@nanosession/x402"
  ]
};

export default nextConfig;
