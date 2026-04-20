/**
 * SolarInvest Design System — Central Design Tokens
 *
 * Fonte única de verdade para cores, tipografia, espaçamento, bordas, sombras
 * e estados de interação. Todos os componentes de UI devem referenciar estes tokens.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de Cores Oficial
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Fundos
  background: '#0B1F3A',
  surface: '#122B4A',
  surfaceHover: '#16345C',
  border: '#1F3D66',

  // Texto
  textPrimary: '#FFFFFF',
  textSecondary: '#A8C1E0',
  textMuted: '#6B8BB5',

  // Ações
  primary: '#2D8CFF',
  primaryHover: '#2070d0',
  success: '#22C55E',
  successHover: '#16a34a',
  danger: '#FF4D4F',
  dangerHover: '#e03031',
  warning: '#F59E0B',

  // Inputs
  inputBg: '#0F2747',
  inputBorder: '#1F3D66',
  inputFocus: '#2D8CFF',
  inputPlaceholder: '#6B8BB5',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Tipografia
// ─────────────────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  weights: {
    regular: 400,
    semibold: 600,
  },
  sizes: {
    h1: { size: '24px', weight: 600, lineHeight: 1.3 },
    h2: { size: '20px', weight: 600, lineHeight: 1.35 },
    h3: { size: '18px', weight: 500, lineHeight: 1.4 },
    body: { size: '14px', weight: 400, lineHeight: 1.6 },
    small: { size: '12px', weight: 400, lineHeight: 1.5 },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Espaçamento — escala 4px
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Bordas e Raios
// ─────────────────────────────────────────────────────────────────────────────

export const radii = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  full: '9999px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Sombras
// ─────────────────────────────────────────────────────────────────────────────

export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.25)',
  md: '0 4px 16px rgba(0, 0, 0, 0.3)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.35)',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Transições
// ─────────────────────────────────────────────────────────────────────────────

export const transitions = {
  fast: 'all 0.15s ease',
  default: 'all 0.2s ease',
  slow: 'all 0.3s ease',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  sidebarWidth: '240px',
  sidebarCollapsedWidth: '64px',
  topbarHeight: '64px',
  contentPaddingX: '24px',
  contentPaddingY: '16px',
  maxContentWidth: '1200px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Cores por contexto de ação (CRUD)
// ─────────────────────────────────────────────────────────────────────────────

export const actionColors = {
  create: colors.success,
  edit: colors.primary,
  delete: colors.danger,
  neutral: colors.textMuted,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// CSS Custom Properties (para uso em css/tailwind via var())
// ─────────────────────────────────────────────────────────────────────────────

export const cssVars = {
  background: 'var(--ds-background)',
  surface: 'var(--ds-surface)',
  surfaceHover: 'var(--ds-surface-hover)',
  border: 'var(--ds-border)',
  textPrimary: 'var(--ds-text-primary)',
  textSecondary: 'var(--ds-text-secondary)',
  textMuted: 'var(--ds-text-muted)',
  primary: 'var(--ds-primary)',
  success: 'var(--ds-success)',
  danger: 'var(--ds-danger)',
  warning: 'var(--ds-warning)',
  inputBg: 'var(--ds-input-bg)',
} as const

export const theme = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  transitions,
  layout,
  actionColors,
  cssVars,
} as const

export type Theme = typeof theme
export type Colors = typeof colors
