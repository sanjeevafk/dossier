/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.{html,js}",
    "./src/**/*.{ts,js}"
  ],
  darkMode: "class",
  theme: {
    extend: {
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
        accentGold: "#facc15",
        accentGoldHover: "#eab308"
      }
    }
  },
  plugins: []
};
