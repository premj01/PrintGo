/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFFDF6',
        secondary: '#FAF6E9',
        accent: '#DDEB9D',
        success: '#A0C878',
        theme: {
          background: '#FFFDF6',
          surface: '#FAF6E9',
          text: '#2D3748',
          textLight: '#718096',
          navbar: '#DDEB9D',
          footer: '#A0C878',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'bounce': 'bounce 1s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
