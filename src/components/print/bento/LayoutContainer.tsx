/**
 * LayoutContainer Component
 * Wrapper for Bento Grid layout with 12-column grid system
 * Optimized for A4/Letter print formats
 */

import React from 'react'

export interface LayoutContainerProps {
  children: React.ReactNode
  className?: string
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div 
      className={`
        grid 
        grid-cols-12 
        gap-4 
        p-8 
        auto-rows-min
        print:w-a4
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {children}
    </div>
  )
}
