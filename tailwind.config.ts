import type { Config } from "tailwindcss";

// case-file tokens — don't rename without updating globals.css too
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-panel": "var(--bg-panel)",
        paper: {
          DEFAULT: "var(--paper)",
          dim: "var(--paper-dim)",
        },
        "stamp-red": "var(--stamp-red)",
        "file-olive": "var(--file-olive)",
        hairline: "var(--hairline)",
        "success-stamp": "var(--success-stamp)",

        bg: {
          primary: "var(--bg-primary)",
          panel: "var(--bg-panel)",
        },

        background: "var(--bg-primary)",
        foreground: "var(--paper)",

        accent: {
          warning: "var(--stamp-red)",
        },

        cyan: {
          DEFAULT: "var(--stamp-red)",
          dark: "#7a1a17",
        },

        success: "var(--success-stamp)",
        warning: "#c47a2c",
        danger: "#8b2e2a",
        muted: "var(--paper-dim)",
        secondary: "var(--file-olive)",
        glass: "rgba(28, 26, 20, 0.92)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        none: "0",
        sm: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
export default config;
