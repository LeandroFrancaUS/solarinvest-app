import React from 'react'

type ProjectMainParamsCardProps = {
  localSection: React.ReactNode
  mainSection?: React.ReactNode
  systemSection?: React.ReactNode
}

export function ProjectMainParamsCard({
  localSection,
  mainSection,
  systemSection,
}: ProjectMainParamsCardProps) {
  return (
    <section className="card project-main-params-card">
      <div className="project-main-params-card__header">
        <div>
          <h3>Parâmetros do Projeto (Local e Tarifas)</h3>
          <p className="project-main-params-card__subtitle">
            Preencha a localização para carregar distribuidora e parâmetros automáticos.
          </p>
        </div>
      </div>
      <div className="project-main-params-card__section">
        <div className="project-main-params-card__section-header">
          <h4>Local do projeto</h4>
          <p>Defina onde está a instalação para ativar validações e listas dependentes.</p>
        </div>
        {localSection}
      </div>
      {mainSection ? (
        <>
          <div className="project-main-params-card__divider" role="presentation" />
          <div className="project-main-params-card__section">
            <div className="project-main-params-card__section-header">
              <h4>Parâmetros principais</h4>
              <p>Informe consumo e tarifas para calcular economia e projeções.</p>
            </div>
            {mainSection}
          </div>
        </>
      ) : null}
      {systemSection ? (
        <>
          <div className="project-main-params-card__divider" role="presentation" />
          <div className="project-main-params-card__section">
            <div className="project-main-params-card__section-header">
              <h4>Configuração do sistema</h4>
              <p>Detalhes técnicos usados no dimensionamento da usina.</p>
            </div>
            {systemSection}
          </div>
        </>
      ) : null}
    </section>
  )
}
