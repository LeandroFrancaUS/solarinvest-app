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
          brand: '#1E88E5',
          dark: '#212121',
          accent: '#1E88E5',
          bg: '#FFFFFF',
          primary: '#1E88E5',
          secondary: '#212121',
          success: '#43A047',
          technical: '#F5F5F5',
          structural: '#E0E0E0',
          text: '#333333',
          danger: '#E53935',
        },
        // Design System — paleta oficial SolarInvest
        ds: {
          background: '#0A1A2F',
          surface: '#122B4A',
          'surface-hover': '#16345C',
          border: '#1F3D66',
          'text-primary': '#FFFFFF',
          'text-secondary': '#D6E4F0',
          'text-muted': '#9FB3C8',
          primary: '#2D8CFF',
          'primary-hover': '#2070d0',
          success: '#22C55E',
          'success-hover': '#16a34a',
          danger: '#FF4D4F',
          'danger-hover': '#e03031',
          warning: '#F59E0B',
          'input-bg': '#0F2747',
        },
      },
      fontFamily: {
        inter: ['Inter', 'system-ui', 'sans-serif'],
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
