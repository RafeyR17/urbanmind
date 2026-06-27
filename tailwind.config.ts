import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: "#0a0f1e",
        glass: "rgba(10,15,30,0.92)",
        cyan: {
          DEFAULT: "#00d4ff",
          dark: "#0099bb",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        muted: "#475569",
        secondary: "#94a3b8",
      },
    },
  },
  plugins: [],
};
export default config;
