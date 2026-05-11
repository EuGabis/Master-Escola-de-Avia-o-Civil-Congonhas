import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Identidade visual Master Escola de Aviacao
        master: {
          orange: {
            DEFAULT: "#F26522",
            50: "#FEF1E9",
            100: "#FDE0CB",
            200: "#FBC198",
            300: "#F9A164",
            400: "#F78231",
            500: "#F26522",
            600: "#D24E13",
            700: "#A03C0E",
            800: "#6E2A0A",
            900: "#3C1705",
          },
          navy: {
            DEFAULT: "#1B2862",
            50: "#E8EAF3",
            100: "#C3C9E0",
            200: "#9BA3C9",
            300: "#727DB2",
            400: "#4A569B",
            500: "#2D397E",
            600: "#1B2862",
            700: "#141E4A",
            800: "#0D1432",
            900: "#070A1A",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "9999px",
      },
    },
  },
  plugins: [],
};
export default config;
