// src/pages/PlaceholderPage.tsx
// Safe placeholder for sidebar sections that do not yet have a dedicated page.

import React from 'react'

export interface PlaceholderPageProps {
  title: string
  description?: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title}</h1>
      <p style={{ color: 'var(--text-muted, #6b7280)', marginBottom: '1rem' }}>
        {description ?? 'Esta seção está em construção e será disponibilizada em breve.'}
      </p>
      <div
        style={{
          border: '1px dashed var(--border-color, #d1d5db)',
          borderRadius: '0.5rem',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted, #9ca3af)',
        }}
      >
        🚧 Em construção
      </div>
    </div>
  )
}
