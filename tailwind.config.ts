import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pn: {
          brand: "#15803D",
          "brand-muted": "#DCFCE7",
          bg: { base: "#F7F8FA", surface: "#FFFFFF", subtle: "#EEF1F5" },
          text: { primary: "#1B2D4F", secondary: "#5A6B85", tertiary: "#8B9BB5" },
          border: { DEFAULT: "#E2E8F0", strong: "#CBD5E1" },
          accent: "#16A34A",
          score: {
            high: "#16A34A",
            "high-bg": "#DCFCE7",
            mid: "#CA8A04",
            "mid-bg": "#FEF9C3",
            low: "#DC2626",
            "low-bg": "#FEE2E2",
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
