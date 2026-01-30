import React from 'react'

interface BrandHeaderProps {
  title?: string
  subtitle?: string
  showLogo?: boolean
  className?: string
}

/**
 * BrandHeader - Premium header component with SolarInvest branding
 * Used for page headers and section dividers
 */
export const BrandHeader: React.FC<BrandHeaderProps> = ({
  title = 'Proposta de Leasing Solar',
  subtitle = 'SolarInvest - Energia Solar sob Medida',
  showLogo = true,
  className = '',
}) => {
  return (
    <div className={`col-span-12 bg-solar-dark text-white rounded-3xl p-8 shadow-md break-inside-avoid ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {title && (
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-white/80 text-sm md:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {showLogo && (
          <div className="ml-6 flex-shrink-0">
            <img 
              src="/brand/logo-header.svg" 
              alt="SolarInvest" 
              className="h-12 md:h-16 w-auto"
            />
          </div>
        )}
      </div>
    </div>
  )
}
