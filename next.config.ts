import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  logging: { serverFunctions: false, incomingRequests: false },
  devIndicators: false,
  reactStrictMode: true,
};

export default config;
