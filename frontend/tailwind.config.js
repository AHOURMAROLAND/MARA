/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'mara-pink': '#FF3366',
        'theme-muted': '#8B949E',
      }
    },
  },
  plugins: [],
}
