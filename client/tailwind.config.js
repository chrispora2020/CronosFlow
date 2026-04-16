/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'alert-flash': {
          '0%, 100%': { backgroundColor: 'rgb(69 10 10)' },   // red-950
          '50%':       { backgroundColor: 'rgb(185 28 28)' },  // red-700
        },
        'alert-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%, 55%': { transform: 'translateX(-12px)' },
          '30%, 70%': { transform: 'translateX(12px)' },
          '85%':       { transform: 'translateX(-6px)' },
        },
        'alert-glow': {
          '0%, 100%': { boxShadow: 'inset 0 0 0px rgba(239,68,68,0)' },
          '50%':       { boxShadow: 'inset 0 0 140px rgba(239,68,68,0.55)' },
        },
      },
      animation: {
        'alert-flash': 'alert-flash 0.55s ease-in-out infinite',
        'alert-shake': 'alert-shake 0.45s ease-in-out infinite',
        'alert-glow':  'alert-glow 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: []
};
