/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#12171B",
          900: "#1A2126",
          800: "#232C32",
          700: "#323D45",
          600: "#4A575F",
          400: "#8A959B",
          200: "#D6DBDD",
          100: "#EEF0F1",
          50: "#F7F8F8",
        },
        rust: {
          600: "#B4562E",
          500: "#D97A3E",
          400: "#E89A5C",
          100: "#FBEADD",
        },
        brass: {
          600: "#A98423",
          500: "#C9A227",
          400: "#DDBC4E",
          100: "#F8F0D6",
        },
        moss: {
          600: "#3E6B4C",
          500: "#4F8862",
          400: "#78AA87",
          100: "#E1EDE4",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
