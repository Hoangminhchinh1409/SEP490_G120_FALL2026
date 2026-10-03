import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Fix Next.js blocking WebSocket from local IP
  experimental: {
    // If it's under experimental
  },
  // In newer Next.js versions it might be at the root
  allowedDevOrigins: ["192.168.1.4", "smart-cobras-wear.loca.lt", "*.loca.lt"],
};

export default nextConfig;
