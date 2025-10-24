import React from 'react'
import type { PrintableProposalImage } from '../../types/printableProposal'

type PrintableProposalImagesProps = {
  images?: PrintableProposalImage[] | null
  heading?: string
}

const PrintableProposalImages: React.FC<PrintableProposalImagesProps> = ({
  images,
  heading = 'Imagens reais do local de instalação',
}) => {
  const validImages = Array.isArray(images)
    ? images.filter((image) => image && typeof image.url === 'string' && image.url.trim().length > 0)
    : []

  if (validImages.length === 0) {
    return null
  }

  const hasMultiple = validImages.length > 1

  return (
    <section className="print-section print-images keep-together page-break-before">
      <h2 className="keep-with-next">{heading}</h2>
      <div
        className={`print-images__grid ${hasMultiple ? 'print-images__grid--multiple' : 'print-images__grid--single'}`}
        role="group"
        aria-label="Galeria de imagens do local de instalação"
      >
        {validImages.map((image, index) => {
          const trimmedName = image.fileName?.trim()
          const altText = trimmedName
            ? `Imagem do local de instalação: ${trimmedName}`
            : `Imagem do local de instalação ${index + 1}`
          return (
            <figure className="print-images__item no-break-inside" key={image.id ?? `imagem-${index}`}>
              <img src={image.url} alt={altText} />
              {trimmedName ? <figcaption>{trimmedName}</figcaption> : null}
            </figure>
          )
        })}
      </div>
    </section>
  )
}

export default PrintableProposalImages
