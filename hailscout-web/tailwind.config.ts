import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", md: "2rem" },
      screens: { "2xl": "1320px" },
    },
    extend: {
      colors: {
        // shadcn semantic tokens — read from globals.css HSL triplets
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Brand palette — Topographic
        cream: {
          DEFAULT: "hsl(var(--cream-100))",
          50:  "hsl(var(--cream-50))",
          100: "hsl(var(--cream-100))",
          200: "hsl(var(--cream-200))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal-700))",
          50:  "hsl(var(--teal-50))",
          200: "hsl(var(--teal-200))",
          500: "hsl(var(--teal-500))",
          700: "hsl(var(--teal-700))",
          900: "hsl(var(--teal-900))",
        },
        copper: {
          DEFAULT: "hsl(var(--copper-500))",
          50:  "hsl(var(--copper-50))",
          300: "hsl(var(--copper-300))",
          500: "hsl(var(--copper-500))",
          700: "hsl(var(--copper-700))",
        },
        forest: {
          DEFAULT: "hsl(var(--forest-500))",
        },

        // Hail size palette — kept across all directions, anchors brand
        hail: {
          "0-75": "#5DCAA5",  // teal-leaning green (atlas-friendly)
          "1-0":  "#E2B843",  // amber
          "1-25": "#D88A3D",  // copper
          "1-5":  "#C46434",  // burnt orange
          "1-75": "#A8412D",  // brick
          "2-0":  "#822424",  // oxblood
          "2-5":  "#5B2059",  // plum
          "3-0":  "#1F1B33",  // deep purple
        },
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Fraunces", "Cambria", "serif"],
        mono:    ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        "tight-display": "-0.025em",
        "wide-caps":     "0.12em",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "atlas":      "0 1px 0 0 hsl(var(--border)), 0 1px 2px 0 hsl(var(--foreground) / 0.04)",
        "atlas-lg":   "0 1px 0 0 hsl(var(--border)), 0 8px 24px -8px hsl(var(--foreground) / 0.08)",
        "panel":      "0 12px 40px -12px hsl(var(--foreground) / 0.18), 0 0 0 1px hsl(var(--border) / 0.6)",
        "focus-ring": "0 0 0 3px hsl(var(--accent) / 0.25)",
      },
      transitionTimingFunction: {
        "atlas": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
