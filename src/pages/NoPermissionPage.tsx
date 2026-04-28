// src/pages/NoPermissionPage.tsx
// Displayed when the authenticated user tries to access a page
// their current role does not permit.

import React from 'react'

export function NoPermissionPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Acesso não permitido
      </h1>
      <p style={{ color: 'var(--text-muted, #6b7280)', marginBottom: '1rem' }}>
        Você não tem permissão para acessar esta página. Se acredita que isso é um engano,
        entre em contato com o administrador do sistema.
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
        🔒 Sem permissão de acesso
      </div>
    </div>
  )
}
