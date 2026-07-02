import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AuthProvider } from "@/hooks/useAuth";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
// PenSnap family: Inter carries display type too (the old theme used the
// Fraunces serif). Same face, second CSS var, so .font-display keeps working.
const display = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  keywords: ["hail", "storm", "roofing", "contractors", "MRMS", "weather radar", "hail map"],
  authors: [{ name: "HailScout" }],
  creator: "HailScout",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://hailscout.net",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  icons: { icon: "/favicon.ico", apple: "/apple-icon" },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0F172A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        <Script
          src="https://pensnap.com/suite/switcher.js"
          data-current="hailscout"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
