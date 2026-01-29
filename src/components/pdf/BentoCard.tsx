import React from 'react'

interface BentoCardProps {
  children: React.ReactNode
  colSpan?: string
  className?: string
  variant?: 'default' | 'highlight' | 'dark'
}

/**
 * BentoCard - Premium card component for Bento Grid layouts
 * Supports multiple variants and configurable column spans
 */
export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  colSpan = 'col-span-12',
  className = '',
  variant = 'default',
}) => {
  const baseClasses = 'rounded-3xl p-6 break-inside-avoid'
  
  const variantClasses = {
    default: 'bg-white shadow-sm border border-slate-100',
    highlight: 'bg-solar-brand text-white border-none shadow-md',
    dark: 'bg-solar-dark text-white border-none shadow-md',
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${colSpan} ${className}`}
      data-testid="bento-card"
    >
      {children}
    </div>
  )
}

/**
 * BentoCardTitle - Typography component for card titles
 * Adapts text color based on context (use text-white class for dark backgrounds)
 */
export const BentoCardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <h3 className={`font-bold tracking-tight text-base mb-3 ${className || 'text-slate-800'}`}>
      {children}
    </h3>
  )
}

/**
 * BentoCardContent - Typography component for card body text
 */
export const BentoCardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`text-slate-600 text-sm leading-6 ${className}`}>
      {children}
    </div>
  )
}
