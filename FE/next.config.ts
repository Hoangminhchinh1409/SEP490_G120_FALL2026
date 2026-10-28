import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: [
      "antd",
      "lucide-react",
      "react-apexcharts",
      "apexcharts",
      "leaflet",
      "react-leaflet",
    ],
  },
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["192.168.1.4", "smart-cobras-wear.loca.lt", "*.loca.lt"],
};

export default nextConfig;
