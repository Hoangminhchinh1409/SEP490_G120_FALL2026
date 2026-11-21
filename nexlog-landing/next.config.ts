import type { NextConfig } from "next";

// Xuất bản dạng static (thư mục /out) để host miễn phí trên bất kỳ nền tảng static nào.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  devIndicators: false,
  turbopack: { root: __dirname },
};

export default nextConfig;
