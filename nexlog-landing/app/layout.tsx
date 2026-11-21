import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00163d",
};

export const metadata: Metadata = {
  title: "NEXLOG – Hệ thống điều phối vận tải thông minh",
  description:
    "Tìm hiểu về NEXLOG: nền tảng quản lý đơn hàng, lập chuyến, giám sát GPS và tra cứu hành trình vận chuyển theo thời gian thực.",
  icons: { icon: "/logo-icon.png", apple: "/logo-icon.png" },
  openGraph: {
    title: "NEXLOG – Hệ thống điều phối vận tải thông minh",
    description:
      "Đặt đơn, theo dõi hành trình và quản lý chứng từ vận chuyển trên một nền tảng duy nhất.",
    images: ["/nexlog-banner.png"],
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${plusJakartaSans.variable} scroll-smooth antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
