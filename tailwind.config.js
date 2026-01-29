/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // A4 paper dimensions and print-specific screens
      screens: {
        print: { raw: 'print' },
      },
      // Solar brand colors
      colors: {
        solar: {
          brand: '#FDB813',
          dark: '#1E293B',
          accent: '#0056b3',
          bg: '#F8FAFC',
        },
      },
      // A4 dimensions (210mm x 297mm)
      width: {
        a4: '210mm',
      },
      height: {
        a4: '297mm',
      },
      // Print-specific spacing
      spacing: {
        mm: '1mm',
        sheet: '10mm',
        gutter: '4mm',
      },
      // Bento grid system
      gridTemplateColumns: {
        'bento-12': 'repeat(12, minmax(0, 1fr))',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const printUtilities = {
        '.break-inside-avoid': {
          'break-inside': 'avoid',
          'page-break-inside': 'avoid',
        },
        '.break-after-page': {
          'break-after': 'page',
          'page-break-after': 'always',
        },
        '.decoration-clone': {
          'box-decoration-break': 'clone',
          '-webkit-box-decoration-break': 'clone',
        },
      }
      addUtilities(printUtilities)
    },
  ],
}
