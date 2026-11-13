import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  logging: { serverFunctions: false, incomingRequests: false },
  devIndicators: false,
  reactStrictMode: true,
  // Documentuploads (max. 8 MB, servergecontroleerd) lopen via serveracties.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
};

export default config;
