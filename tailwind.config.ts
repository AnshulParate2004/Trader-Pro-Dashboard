import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#007d33",
          bright: "#00c851",
          hover: "#006328",
          tint: "rgba(0, 200, 81, 0.10)",
          dark: "#005020",
        },
        chrome: {
          bg: "#ececed",
          canvas: "#ffffff",
          field: "#f4f4f6",
          line: "#cfcfd6",
          edge: "#e4e9f2",
          rule: "#c5d3e8",
          ink: "#111111",
          dim: "#506b9c",
          slate: "#46639f",
          icon: "#444746",
          mute: "#9bafd3",
          green: "#00c851",
          "green-ink": "#007d33",
          tint: "#f7f9fc",
        },
        loss: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
          tint: "rgba(239, 68, 68, 0.08)",
        },
        win: {
          DEFAULT: "#00c851",
          dark: "#007d33",
          tint: "rgba(0, 200, 81, 0.08)",
        },
      },
      fontFamily: {
        brand: ["'GT Planar'", "sans-serif"],
        body: ["'Plain'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        sans: ["'Plain'", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'GT Standard Mono'", "'GeistMono'", "ui-monospace", "monospace"],
        bbmono: ["'GT Standard Mono'", "'GeistMono'", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        card: "0 0 0 1px #cfcfd6, 0 1px 2px 0 rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
