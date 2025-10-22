export const CHART_THEME = {
  light: {
    grid: 'rgba(100,116,139,0.2)',
    tick: '#334155',
    legend: '#1E293B',
    tooltipBg: 'rgba(255,255,255,0.96)',
    tooltipText: '#0B0F1A',
  },
  dark: {
    grid: 'rgba(148,163,184,0.25)',
    tick: '#E5EAF4',
    legend: '#FFFFFF',
    tooltipBg: 'rgba(10,15,25,0.96)',
    tooltipText: '#F9FAFC',
  },
} as const

export type ChartThemeKey = keyof typeof CHART_THEME
