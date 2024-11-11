/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // Add all possible locations:
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./renderer/**/*.{js,ts,jsx,tsx,html}", // if you use a renderer folder
    "./main/**/*.{js,ts,jsx,tsx,html}",     // if you use a main folder
    "./app/**/*.{js,ts,jsx,tsx,html}",      // if you use an app folder
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}