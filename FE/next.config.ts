import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Fix Next.js blocking WebSocket from local IP
  experimental: {
    optimizePackageImports: ["antd", "lucide-react", "react-apexcharts", "apexcharts"],
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["192.168.1.4", "smart-cobras-wear.loca.lt", "*.loca.lt"],
};

export default nextConfig;
