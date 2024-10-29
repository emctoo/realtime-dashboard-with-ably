/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  // theme: {
  //   extend: {},
  // },
  theme: {
    extend: {
      colors: {
        navy: "#0a0d1a",
      },
    },
  },
  plugins: [],
};
