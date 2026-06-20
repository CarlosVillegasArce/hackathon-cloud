/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4fb',
          100: '#d6e4f4',
          200: '#aac6e7',
          300: '#7aa6d8',
          400: '#4f87c8',
          500: '#2e6cb3',
          600: '#1f558f',
          700: '#1a4574',
          800: '#163a5f',
          900: '#0f2944',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
