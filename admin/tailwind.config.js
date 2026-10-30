/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1120',
          850: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        emergency: {
          crimson: '#EF4444',
          orange: '#F97316',
          yellow: '#EAB308',
          green: '#10B981',
          purple: '#8B5CF6',
          blue: '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
