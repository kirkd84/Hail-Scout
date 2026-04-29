import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

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
    url: "https://hail-scout.vercel.app",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0F4C5C",
          colorBackground: "#F5F1EA",
          colorText: "#2B2620",
          colorInputBackground: "#FAF7F1",
          colorInputText: "#2B2620",
          colorTextOnPrimaryBackground: "#F5F1EA",
          borderRadius: "0.625rem",
          fontFamily: "var(--font-sans), Inter, system-ui, sans-serif",
        },
      }}
    >
      <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
        <body className="bg-background text-foreground antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
