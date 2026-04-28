import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.2"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
