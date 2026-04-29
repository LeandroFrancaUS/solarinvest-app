// src/components/PropostaImagensSection.tsx
// Section card listing images attached to a proposal, with add/remove controls.
// Pure presentational component; all state lives in App.tsx.

import type { TabKey } from '../app/config'
import type { PrintableProposalImage } from '../types/printableProposal'

export type PropostaImagensSectionProps = {
  propostaImagens: PrintableProposalImage[]
  activeTab: TabKey
  onAddImages: () => void
  onRemoveImagem: (imagemId: string, fallbackIndex: number) => void
}

export function PropostaImagensSection({
  propostaImagens,
  activeTab,
  onAddImages,
  onRemoveImagem,
}: PropostaImagensSectionProps) {
  if (propostaImagens.length === 0) {
    return null
  }

  const descricao =
    activeTab === 'leasing'
      ? 'Estas imagens serão exibidas na proposta de leasing. Remova as que não devem aparecer.'
      : 'Estas imagens serão exibidas na proposta de vendas. Remova as que não devem aparecer.'

  return (
    <section className="card proposal-images-card">
      <div className="card-header">
        <h2>Imagens anexadas à proposta</h2>
        <button type="button" className="ghost" onClick={onAddImages}>
          Adicionar imagens
        </button>
      </div>
      <p className="muted proposal-images-description">{descricao}</p>
      <div className="proposal-images-grid">
        {propostaImagens.map((imagem, index) => {
          const trimmedName = imagem.fileName?.trim()
          const label = trimmedName && trimmedName.length > 0 ? trimmedName : `Imagem ${index + 1}`
          return (
            <figure
              key={imagem.id ?? `imagem-${index}`}
              className="proposal-images-item"
              aria-label={`Pré-visualização da imagem ${index + 1}`}
            >
              <div className="proposal-images-thumb">
                <img src={imagem.url} alt={`Imagem anexada: ${label}`} />
              </div>
              <figcaption>
                <span title={label}>{label}</span>
                <button
                  type="button"
                  className="link danger"
                  onClick={() => onRemoveImagem(imagem.id, index)}
                >
                  Remover
                </button>
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
