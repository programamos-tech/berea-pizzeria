import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AccountSwitchLoadingProvider } from "@/components/admin/AccountSwitchLoading";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";

export const metadata: Metadata = {
  title: {
    default: "Berea Pizzerías",
    template: "%s · Berea Pizzerías",
  },
  applicationName: "Berea Pizzerías",
  appleWebApp: {
    capable: true,
    title: "Berea Pizzerías",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/admin/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
  colorScheme: "light dark",
};

/**
 * Aplica theme-color / color-scheme antes del paint según localStorage.
 * Mutates <html>/<body> styles intentionally — root layout uses
 * suppressHydrationWarning so React does not flag the SSR/client diff.
 */
const ADMIN_THEME_BOOT = `(function(){try{var t=localStorage.getItem("tiendas-admin-theme");if(t!=="dark"&&t!=="light")t="light";var c=t==="dark"?"#09090b":"#ffffff";document.documentElement.style.colorScheme=t;document.documentElement.style.backgroundColor=c;var metas=document.querySelectorAll('meta[name="theme-color"]');if(!metas.length){var m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m);metas=document.querySelectorAll('meta[name="theme-color"]');}metas.forEach(function(m){m.setAttribute("content",c);m.removeAttribute("media");});var a=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(!a){a=document.createElement("meta");a.setAttribute("name","apple-mobile-web-app-status-bar-style");document.head.appendChild(a);}a.setAttribute("content",t==="dark"?"black-translucent":"default");}catch(e){}})();`;

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="admin-theme-boot"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: ADMIN_THEME_BOOT }}
      />
      <AdminThemeProvider>
        <AccountSwitchLoadingProvider>{children}</AccountSwitchLoadingProvider>
      </AdminThemeProvider>
    </>
  );
}
