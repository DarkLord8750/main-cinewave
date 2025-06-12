/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cinewave: {
          red: '#E50914',
          black: '#000000',
          dark: '#141414',
          gray: '#808080',
          white: '#FFFFFF'
        },
        netflix: {
          red: '#E50914',
          black: '#000000',
          dark: '#141414',
          gray: '#808080',
          white: '#FFFFFF'
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'scale-up': 'scaleUp 0.3s ease-in-out',
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'fadeOut': 'fadeOut 0.8s ease-in-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        scaleUp: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
