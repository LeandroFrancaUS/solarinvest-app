import React from 'react'

interface PrintLayoutProps {
  children: React.ReactNode
  className?: string
}

/**
 * PrintLayout - Wrapper for A4 print pages with Bento Grid system
 * Provides the "paper" container with proper dimensions and grid structure
 */
export const PrintLayout: React.FC<PrintLayoutProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`w-a4 min-h-a4 bg-slate-50 page relative box-border overflow-hidden print-typography font-inter ${className}`}
      data-testid="print-layout"
    >
      <div className="grid grid-cols-bento-12 gap-gutter auto-rows-min">
        {children}
      </div>
    </div>
  )
}
