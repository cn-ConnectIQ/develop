import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-connectiq-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConnectIQ 管理端",
  description: "ConnectIQ 后台管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSansSC.variable} light h-full antialiased`}
    >
      <body className="flex h-full min-h-full flex-col bg-content-bg font-sans text-[var(--admin-ink)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
