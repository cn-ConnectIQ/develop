import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans_SC } from "next/font/google";
import { Providers } from "@/components/providers";
import { withPublicPath } from "@/lib/public-path";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-connectiq-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://9li.co/uc";

/** 与官网一致：玖莅方标；带 /uc，避免浏览器落到域名根 favicon */
const brandFavicon = withPublicPath("/favicon.ico");
const brandIconPng = withPublicPath("/icon.png");
const brandAppleIcon = withPublicPath("/apple-icon.png");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "玖莅 管理端",
    template: "%s · 玖莅",
  },
  description: "玖莅 后台管理系统",
  icons: {
    icon: [
      { url: brandIconPng, type: "image/png", sizes: "288x288" },
      { url: brandFavicon, sizes: "any", type: "image/x-icon" },
    ],
    apple: [{ url: brandAppleIcon, type: "image/png", sizes: "288x288" }],
    shortcut: brandFavicon,
  },
};

function earlyFetchPatchSource() {
  let base =
    process.env.NEXT_PUBLIC_BASE_PATH?.trim() ||
    (() => {
      try {
        const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
        if (!u) return "/uc";
        const p = new URL(u).pathname.replace(/\/$/, "");
        return p && p !== "/" ? p : "/uc";
      } catch {
        return "/uc";
      }
    })();
  if (!base || base === "/") base = "/uc";
  return `(function(){try{var b=${JSON.stringify(base)};var f=window.fetch.bind(window);window.fetch=function(i,n){if(typeof i==="string"&&(i==="/api"||i.indexOf("/api/")===0)&&i.indexOf(b)!==0){i=b+i;}return f(i,n);};}catch(e){}})();`;
}

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
        <Script id="uc-api-base-path" strategy="beforeInteractive">
          {earlyFetchPatchSource()}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
