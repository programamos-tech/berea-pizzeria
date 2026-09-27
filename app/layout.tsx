import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import { storeBrand, storeShortDescription } from "@/lib/brand";
import {
  ADMIN_CORAL,
  ADMIN_CORAL_DEEP,
  ADMIN_CORAL_HOVER,
  ADMIN_CORAL_MIST,
  ADMIN_CORAL_SOFT,
  ADMIN_LOSS,
  ADMIN_LOSS_DARK,
  ADMIN_PROFIT,
  ADMIN_PROFIT_DARK,
  ADMIN_SIDEBAR_BG,
  ADMIN_SIDEBAR_BG_DARK,
  STORE_CHROME_BG,
} from "@/lib/admin-theme";
import { storeCheckoutBootScriptSource } from "@/lib/store-checkout-nav";
import {
  STORE_ACCENT,
  STORE_ACCENT_HOVER,
  STORE_ANNOUNCEMENT_BG,
  STORE_BRAND,
  STORE_BRAND_HOVER,
  STORE_IMAGE_WELL,
  STORE_IMAGE_WELL_TINT,
} from "@/lib/store-theme";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: storeBrand,
  description: storeShortDescription,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      // Admin theme boot (`app/admin/layout.tsx`) sets color-scheme /
      // backgroundColor on <html> before React hydrates (localStorage).
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Stack+Sans+Notch:wght@200..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="flex min-h-full flex-col bg-white text-stone-800"
        // Same admin theme boot / AdminThemeProvider may touch body chrome.
        suppressHydrationWarning
        style={
          {
            "--admin-sidebar-bg": ADMIN_SIDEBAR_BG,
            "--admin-sidebar-bg-dark": ADMIN_SIDEBAR_BG_DARK,
            "--admin-coral": ADMIN_CORAL,
            "--admin-coral-hover": ADMIN_CORAL_HOVER,
            "--admin-coral-deep": ADMIN_CORAL_DEEP,
            "--admin-coral-soft": ADMIN_CORAL_SOFT,
            "--admin-coral-mist": ADMIN_CORAL_MIST,
            "--admin-profit": ADMIN_PROFIT,
            "--admin-profit-dark": ADMIN_PROFIT_DARK,
            "--admin-loss": ADMIN_LOSS,
            "--admin-loss-dark": ADMIN_LOSS_DARK,
            "--store-chrome-bg": STORE_CHROME_BG,
            "--store-accent": STORE_ACCENT,
            "--store-accent-hover": STORE_ACCENT_HOVER,
            "--store-brand": STORE_BRAND,
            "--store-brand-hover": STORE_BRAND_HOVER,
            "--store-image-well": STORE_IMAGE_WELL,
            "--store-image-well-tint": STORE_IMAGE_WELL_TINT,
            "--store-announcement-bg": STORE_ANNOUNCEMENT_BG,
            "--store-wash": "#FFF5F8",
          } as CSSProperties
        }
      >
        <Script
          id="store-checkout-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: storeCheckoutBootScriptSource(storeBrand),
          }}
        />
        {children}
      </body>
    </html>
  );
}
