import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Hail size color palette per PRD §2.5
        "hail-0-75": "#22c55e", // green
        "hail-1-0": "#eab308", // yellow
        "hail-1-25": "#f97316", // orange
        "hail-1-5": "#f97316", // orange
        "hail-1-75": "#ef4444", // red
        "hail-2-0": "#ef4444", // red
        "hail-2-5": "#a855f7", // purple
        "hail-3-0": "#000000", // black
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius, 0.5rem)",
        md: "calc(var(--radius, 0.5rem) - 2px)",
        sm: "calc(var(--radius, 0.5rem) - 4px)",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
