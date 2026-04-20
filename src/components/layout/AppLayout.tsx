/**
 * AppLayout — Layout wrapper padrão do Design System SolarInvest
 *
 * Estrutura: [ Sidebar ] [ Header ] [ Content ]
 *
 * Padding horizontal: 24px
 * Padding vertical: 16px
 * Max-width opcional: 1200px
 */

import React from 'react'

export interface AppLayoutProps {
  /** Conteúdo da área principal */
  children: React.ReactNode
  /** Título da página (exibido no topo da área de conteúdo) */
  pageTitle?: React.ReactNode
  /** Subtítulo ou breadcrumb da página */
  pageSubtitle?: React.ReactNode
  /** Ações do cabeçalho da página (botões, filtros etc.) */
  pageActions?: React.ReactNode
  /** Largura máxima do conteúdo. Padrão: 1200px */
  maxWidth?: string | false
  /** Remove o padding padrão do conteúdo */
  noPadding?: boolean
  className?: string
}

export function AppLayout({
  children,
  pageTitle,
  pageSubtitle,
  pageActions,
  maxWidth = '1200px',
  noPadding = false,
  className = '',
}: AppLayoutProps) {
  const hasPageHeader = Boolean(pageTitle || pageSubtitle || pageActions)

  return (
    <div
      className={`flex min-h-full flex-col bg-ds-background text-ds-text-primary ${className}`}
    >
      {/* Page header */}
      {hasPageHeader ? (
        <div
          className="border-b border-ds-border bg-ds-surface/60 px-6 py-4"
          style={maxWidth ? { maxWidth, marginInline: 'auto', width: '100%' } : undefined}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            style={maxWidth ? {} : undefined}
          >
            <div className="min-w-0 flex-1">
              {pageTitle ? (
                <h1 className="text-2xl font-semibold text-ds-text-primary leading-tight">
                  {pageTitle}
                </h1>
              ) : null}
              {pageSubtitle ? (
                <p className="mt-1 text-sm text-ds-text-muted">{pageSubtitle}</p>
              ) : null}
            </div>
            {pageActions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {pageActions}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main content */}
      <main
        className={noPadding ? 'flex-1' : 'flex-1 px-6 py-4'}
        style={
          maxWidth
            ? { maxWidth, marginInline: 'auto', width: '100%' }
            : undefined
        }
      >
        {children}
      </main>
    </div>
  )
}
