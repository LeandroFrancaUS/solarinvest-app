// src/components/portfolio/PortfolioPaymentStatusBadge.tsx
import {
  LANDING_PAYMENT_STATUS_META,
  type LandingPaymentStatus,
} from '../../domain/billing/paymentStatusEngine'

export function PortfolioPaymentStatusBadge({ status }: { status: LandingPaymentStatus }) {
  const meta = LANDING_PAYMENT_STATUS_META[status]

  return (
    <span
      style={{
        marginLeft: 8,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
      }}
      title={meta.label}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  )
}
