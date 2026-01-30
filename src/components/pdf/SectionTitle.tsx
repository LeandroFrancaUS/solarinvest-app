import React from 'react'

interface SectionTitleProps {
  children: React.ReactNode
  className?: string
  level?: 1 | 2 | 3
}

/**
 * SectionTitle - Consistent typography for section headings
 * Prevents orphaned titles with break-after-avoid
 */
export const SectionTitle: React.FC<SectionTitleProps> = ({
  children,
  className = '',
  level = 2,
}) => {
  const baseClasses = 'font-bold text-slate-800 tracking-tight break-after-avoid'
  
  const sizeClasses = {
    1: 'text-3xl md:text-4xl mb-4',
    2: 'text-2xl md:text-3xl mb-3',
    3: 'text-xl md:text-2xl mb-2',
  }

  const Tag = `h${level}` as keyof JSX.IntrinsicElements

  return (
    <Tag className={`${baseClasses} ${sizeClasses[level]} ${className}`}>
      {children}
    </Tag>
  )
}
