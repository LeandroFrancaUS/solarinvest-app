import React from 'react'

interface PrintLayoutProps {
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
}

/**
 * PrintLayout - Wrapper for A4 print pages with Bento Grid system
 * Provides the "paper" container with proper dimensions and grid structure
 */
export const PrintLayout: React.FC<PrintLayoutProps> = ({ children, className = '', footer }) => {
  const paddingClass = footer ? 'pt-8 pb-20' : 'py-8'
  return (
    <div
      className={`w-a4 min-h-a4 bg-slate-50 page relative box-border overflow-hidden print-typography font-inter px-10 ${paddingClass} ${className}`}
      data-testid="print-layout"
    >
      <div className="grid grid-cols-bento-12 gap-gutter auto-rows-min">
        {children}
      </div>
      {footer ? (
        <div className="absolute bottom-6 left-10 right-10 text-[10px] text-slate-500 whitespace-pre-line">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
