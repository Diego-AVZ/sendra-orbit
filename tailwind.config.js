/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070814',
        night: '#0d1224',
        panel: '#14192c',
        line: '#2c334c',
        ivory: '#f4efe6',
        mist: '#b7b1a4',
        copper: '#e3a45c',
        cream: '#f6d7a8',
        ice: '#9ec9ff',
        moss: '#8ed4ae',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      letterSpacing: {
        eyebrow: '0.22em',
      },
      boxShadow: {
        ticket: '0 30px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
