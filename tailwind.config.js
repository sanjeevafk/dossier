/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.{html,js}",
    "./src/**/*.{ts,js}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)" },
      transitionDuration: { DEFAULT: "150ms" },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"]
      },
      colors: {
        sand: {
          50: "#fbfbfa",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          800: "#292524",
          900: "#1c1917"
        },
        page: "rgb(var(--c-page) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        raised: "rgb(var(--c-raised) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        line: { DEFAULT: "rgb(var(--c-line) / <alpha-value>)", strong: "rgb(var(--c-line-strong) / <alpha-value>)" },
        ink: { DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", 2: "rgb(var(--c-ink-2) / <alpha-value>)", 3: "rgb(var(--c-ink-3) / <alpha-value>)" },
        inverse: { DEFAULT: "rgb(var(--c-inverse) / <alpha-value>)", hover: "rgb(var(--c-inverse-hover) / <alpha-value>)" },
        code: "rgb(var(--c-code) / <alpha-value>)",
        ok: { DEFAULT: "rgb(var(--c-ok) / <alpha-value>)", soft: "rgb(var(--c-ok-soft) / <alpha-value>)", line: "rgb(var(--c-ok-line) / <alpha-value>)" },
        warn: { DEFAULT: "rgb(var(--c-warn) / <alpha-value>)", soft: "rgb(var(--c-warn-soft) / <alpha-value>)" },
        bad: { DEFAULT: "rgb(var(--c-bad) / <alpha-value>)", soft: "rgb(var(--c-bad-soft) / <alpha-value>)", line: "rgb(var(--c-bad-line) / <alpha-value>)" },
        accentGold: "#facc15",
        accentGoldHover: "#eab308"
      }
    }
  },
  plugins: []
};
