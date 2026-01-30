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
  const baseClasses = 'rounded-[24px] p-8 break-inside-avoid border border-slate-200/60 shadow-sm'
  
  const variantClasses = {
    default: 'bg-white text-slate-600',
    highlight: 'bg-amber-500 text-white border-none shadow-md',
    dark: 'bg-slate-900 text-white border-none shadow-md',
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
    <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${className || 'text-slate-400'}`}>
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
    <div className={`text-slate-500 text-sm leading-6 ${className}`}>
      {children}
    </div>
  )
}
