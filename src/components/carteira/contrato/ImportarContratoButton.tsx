import React from 'react'

export function ImportarContratoButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="pf-btn pf-btn-edit" onClick={onClick} disabled={disabled}>
      ⬆️ Importar contrato
    </button>
  )
}
