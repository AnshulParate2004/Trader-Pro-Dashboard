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
        trade: {
          long: "#089981",
          short: "#f23645",
          blue: "#0070f3",
          amber: "#f59e0b",
        }
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Inter", "sans-serif"],
        mono: ["GeistMono", "JetBrains Mono", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
