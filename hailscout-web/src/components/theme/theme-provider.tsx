"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ComponentProps } from "react";

/**
 * Client-side theme provider. Defaults to "system" so HailScout
 * follows the OS preference. The `class` attribute strategy plays
 * nicely with Tailwind's `darkMode: ["class"]` config.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
