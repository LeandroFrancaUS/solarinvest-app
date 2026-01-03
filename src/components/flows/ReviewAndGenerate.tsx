import type { ReactNode } from 'react'
import './flows.css'

interface ReviewAndGenerateProps {
  pendencias: string[]
  onGenerate: () => void
  onCopyLink?: () => void
  onDownload?: () => void
  extraActions?: ReactNode
}

export function ReviewAndGenerate({ pendencias, onGenerate, onCopyLink, onDownload, extraActions }: ReviewAndGenerateProps) {
  const hasPendencias = pendencias.length > 0
  return (
    <div className="review-generate">
      <div className="review-header">
        <h3>Revisão final</h3>
        <p>Confirme os dados antes de gerar a proposta.</p>
      </div>

      {hasPendencias ? (
        <div className="review-pendencias">
          <strong>Pendências encontradas:</strong>
          <ul>
            {pendencias.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="review-ok">Tudo pronto para gerar a proposta.</div>
      )}

      <div className="review-actions">
        <button className="primary" onClick={onGenerate} disabled={hasPendencias}>
          Gerar Proposta
        </button>
        {onCopyLink ? (
          <button className="ghost" onClick={onCopyLink}>
            Copiar link
          </button>
        ) : null}
        {onDownload ? (
          <button className="ghost" onClick={onDownload}>
            Baixar PDF
          </button>
        ) : null}
        {extraActions}
      </div>
    </div>
  )
}
