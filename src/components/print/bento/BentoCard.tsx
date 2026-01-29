/**
 * BentoCard Component
 * Modular card component for Bento Grid layouts
 * Supports column/row spans and multiple visual variants
 * Automatically prevents fragmentation across page breaks
 */

import React from 'react'

export type BentoCardVariant = 'default' | 'highlight' | 'inverted'

export interface BentoCardProps {
  children: React.ReactNode
  colSpan?: number // 1-12 (default: 4)
  rowSpan?: number // number of rows (default: auto)
  variant?: BentoCardVariant
  className?: string
}

const variantStyles: Record<BentoCardVariant, string> = {
  default: 'bg-white border border-gray-200',
  highlight: 'bg-solarinvest-primary bg-opacity-10 border-2 border-solarinvest-primary',
  inverted: 'bg-solarinvest-secondary text-white',
}

export const BentoCard: React.FC<BentoCardProps> = ({ 
  children, 
  colSpan = 4, 
  rowSpan,
  variant = 'default',
  className = '' 
}) => {
  const colSpanClass = `col-span-${Math.min(12, Math.max(1, colSpan))}`
  const rowSpanClass = rowSpan ? `row-span-${rowSpan}` : ''
  
  return (
    <div 
      className={`
        ${colSpanClass}
        ${rowSpanClass}
        ${variantStyles[variant]}
        break-inside-avoid
        decoration-clone
        rounded-lg
        p-4
        shadow-sm
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  )
}
