import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pn: {
          brand: "rgb(var(--pn-brand) / <alpha-value>)",
          "brand-muted": "rgb(var(--pn-brand-muted) / <alpha-value>)",
          bg: {
            base: "rgb(var(--pn-bg-base) / <alpha-value>)",
            surface: "rgb(var(--pn-bg-surface) / <alpha-value>)",
            subtle: "rgb(var(--pn-bg-subtle) / <alpha-value>)",
          },
          text: {
            primary: "rgb(var(--pn-text-primary) / <alpha-value>)",
            secondary: "rgb(var(--pn-text-secondary) / <alpha-value>)",
            tertiary: "rgb(var(--pn-text-tertiary) / <alpha-value>)",
          },
          border: {
            DEFAULT: "rgb(var(--pn-border) / <alpha-value>)",
            strong: "rgb(var(--pn-border-strong) / <alpha-value>)",
          },
          accent: "rgb(var(--pn-accent) / <alpha-value>)",
          "input-bg": "rgb(var(--pn-input-bg) / <alpha-value>)",
          "input-text": "rgb(var(--pn-input-text) / <alpha-value>)",
          score: {
            high: "rgb(var(--pn-score-high) / <alpha-value>)",
            "high-bg": "rgb(var(--pn-score-high-bg) / <alpha-value>)",
            mid: "rgb(var(--pn-score-mid) / <alpha-value>)",
            "mid-bg": "rgb(var(--pn-score-mid-bg) / <alpha-value>)",
            low: "rgb(var(--pn-score-low) / <alpha-value>)",
            "low-bg": "rgb(var(--pn-score-low-bg) / <alpha-value>)",
          },
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
