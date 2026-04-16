/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Sepia Classic
        sepia: {
          bg: '#F4EFE8',
          text: '#3A3228',
          accent: '#8B6F47',
        },
        // Night Mode
        night: {
          bg: '#1A1A1A',
          text: '#E8E6E3',
          accent: '#A78BFA',
        },
        // Forest Green
        forest: {
          bg: '#E8F0E8',
          text: '#2D3E2D',
          accent: '#4A7C59',
        },
        // Lavender Dream
        lavender: {
          bg: '#F0EBF4',
          text: '#3E3548',
          accent: '#9B7EBD',
        },
        // Midnight OLED
        midnight: {
          bg: '#000000',
          text: '#CCCCCC',
          accent: '#00D9FF',
        },
        // Parchment
        parchment: {
          bg: '#FFFBF5',
          text: '#2C2416',
          accent: '#9D7651',
        },
        // Warm paper tones
        paper: {
          warm: '#FFFBF5',
          cream: '#F4EFE8',
          tan: '#E8DFD0',
        },
      },
      fontFamily: {
        manrope: ['Manrope', 'sans-serif'],
        newsreader: ['Newsreader', 'serif'],
        'crimson-pro': ['Crimson Pro', 'serif'],
        lora: ['Lora', 'serif'],
        'ibm-plex': ['IBM Plex Sans', 'sans-serif'],
        'jetbrains': ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        soft: '0 4px 12px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'soft-xl': '0 12px 36px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
};
