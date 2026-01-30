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
  const baseClasses = 'rounded-lg p-6 break-inside-avoid border border-solar-structural'
  
  const variantClasses = {
    default: 'bg-solar-technical text-solar-text shadow-sm',
    highlight: 'bg-solar-primary text-white border-none shadow-md',
    dark: 'bg-solar-secondary text-white border-none shadow-md',
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
    <h3 className={`font-bold tracking-tight text-base mb-3 ${className || 'text-solar-secondary'}`}>
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
    <div className={`text-solar-text text-sm leading-6 ${className}`}>
      {children}
    </div>
  )
}
