/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0e0e10',
          1: '#18181b',
          2: '#1f1f23',
          3: '#27272a',
          4: '#3f3f46',
        },
        accent: '#6366f1',
        'accent-hover': '#818cf8',
        muted: '#71717a',
        border: '#3f3f46',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
