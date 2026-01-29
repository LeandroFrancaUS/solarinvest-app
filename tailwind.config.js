import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },
      width: {
        a4: '210mm',
      },
      height: {
        a4: '297mm',
      },
      colors: {
        solarinvest: {
          primary: '#F59E0B',
          secondary: '#1E293B',
          accent: '#10B981',
        },
      },
    },
  },
  plugins: [
    typography,
    // Custom fragmentation plugin for print
    function({ addUtilities }) {
      const fragmentationUtilities = {
        '.break-inside-avoid': {
          'break-inside': 'avoid',
          'page-break-inside': 'avoid',
        },
        '.break-after-page': {
          'break-after': 'page',
          'page-break-after': 'always',
        },
        '.break-before-page': {
          'break-before': 'page',
          'page-break-before': 'always',
        },
        '.decoration-clone': {
          'box-decoration-break': 'clone',
          '-webkit-box-decoration-break': 'clone',
        },
      }
      addUtilities(fragmentationUtilities)
    },
  ],
}
