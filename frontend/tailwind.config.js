/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Desk2Educate brand colors
        teal: {
          50: '#e6f5f5',
          100: '#b3e0e0',
          200: '#80cbcb',
          300: '#4db6b6',
          400: '#1aa1a1',
          500: '#017576', // Primary teal
          600: '#016363',
          700: '#015151',
          800: '#013f3f',
          900: '#002d2d',
        },
        purple: {
          50: '#f0edf5',
          100: '#d4cce6',
          200: '#b8abd7',
          300: '#9c8ac8',
          400: '#8069b9',
          500: '#60489d', // Primary purple
          600: '#523d86',
          700: '#44336f',
          800: '#362858',
          900: '#281e41',
        },
      },
    },
  },
  plugins: [],
}
