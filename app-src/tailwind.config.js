/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colours from the Setwel logo: copper/orange accent, gold, slate (the Africa shape).
        // The key names stay as they were so existing screens keep working.
        brand: {
          green: '#C9621A', // primary accent (was green): copper-orange
          greenDark: '#A84F12',
          gold: '#E3A548',
          navy: '#2C3743', // slate: sidebar and headings
          navyLight: '#3E4C5A',
          panel: '#F6F1EA' // warm cream page background
        },
        status: {
          paid: '#0E8A4B',
          overdue: '#D7263D',
          draft: '#8A93A6',
          sent: '#2563EB',
          partial: '#E08E0B'
        }
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(13,27,42,0.06), 0 1px 3px 0 rgba(13,27,42,0.08)'
      }
    }
  },
  plugins: []
}
