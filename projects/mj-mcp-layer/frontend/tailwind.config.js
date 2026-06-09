/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#13131A",
        border: "#1E1E2E",
        primary: "#6C63FF",
        accent: "#00D4FF",
        success: "#00FF94",
        warning: "#FFB800",
        danger: "#FF4757",
        text: "#E8E8F0",
        muted: "#6B6B8A",
      },
    },
  },
  plugins: [],
};
