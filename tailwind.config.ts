import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carvao: "rgb(var(--c-carvao) / <alpha-value>)",
        taupe: "rgb(var(--c-taupe) / <alpha-value>)",
        areia: "rgb(var(--c-areia) / <alpha-value>)",
        marfim: "rgb(var(--c-marfim) / <alpha-value>)",
        destaque: "rgb(var(--c-destaque) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
