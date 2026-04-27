import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "hail",
    "mapping",
    "roofing",
    "storm",
    "damage",
    "contractors",
  ],
  authors: [{ name: "HailScout" }],
  creator: "HailScout",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://app.hailscout.com",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-background text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
