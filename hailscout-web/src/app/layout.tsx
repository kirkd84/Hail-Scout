import type { Metadata } from "next";
import { AuthProvider } from "@/hooks/useAuth";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { ThemeProvider } from "@/components/theme/theme-provider";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  keywords: ["hail", "storm", "roofing", "contractors", "MRMS", "weather radar", "atlas"],
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
  icons: { icon: "/favicon.ico" },
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
      </body>
    </html>
  );
}
