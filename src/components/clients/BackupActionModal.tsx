// src/components/clients/BackupActionModal.tsx
// Professional modal replacing the raw window.prompt backup action picker.

import React, { useId, useState } from 'react'

export type BackupDestino = 'local' | 'nuvem' | 'plataforma'

interface BackupActionModalProps {
  isLoading: boolean
  onDownload: (destino: BackupDestino) => void
  onUpload: () => void
  onClose: () => void
}

const DESTINO_OPTIONS: { value: BackupDestino; label: string; description: string; icon: string }[] = [
  {
    value: 'local',
    label: 'Dispositivo local',
    description: 'Salvar o arquivo .json diretamente no seu computador ou celular.',
    icon: '💾',
  },
  {
    value: 'nuvem',
    label: 'Compartilhar (nuvem)',
    description: 'Baixar e compartilhar via Web Share (WhatsApp, Drive, etc.).',
    icon: '☁️',
  },
  {
    value: 'plataforma',
    label: 'Plataforma SolarInvest',
    description: 'Registrar o backup na plataforma (Neon) para restauração remota.',
    icon: '🏢',
  },
]

export function BackupActionModal({ isLoading, onDownload, onUpload, onClose }: BackupActionModalProps) {
  const titleId = useId()
  const [selectedAction, setSelectedAction] = useState<'download' | 'upload' | null>(null)
  const [destino, setDestino] = useState<BackupDestino>('local')

  const handleConfirm = () => {
    if (selectedAction === 'upload') {
      onUpload()
    } else if (selectedAction === 'download') {
      onDownload(destino)
    }
  }

  return (
    <div
      className="backup-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="backup-modal">
        {/* Header */}
        <div className="backup-modal__header">
          <div className="backup-modal__header-icon" aria-hidden="true">🗄️</div>
          <div>
            <h2 id={titleId} className="backup-modal__title">Backup de Dados</h2>
            <p className="backup-modal__subtitle">Escolha a ação que deseja realizar</p>
          </div>
          <button
            type="button"
            className="ghost backup-modal__close"
            onClick={onClose}
            aria-label="Fechar"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Action cards */}
        <div className="backup-modal__actions">
          <button
            type="button"
            className={`backup-modal__card${selectedAction === 'download' ? ' backup-modal__card--active' : ''}`}
            onClick={() => setSelectedAction('download')}
            disabled={isLoading}
          >
            <span className="backup-modal__card-icon" aria-hidden="true">⬇️</span>
            <span className="backup-modal__card-title">Baixar Backup</span>
            <span className="backup-modal__card-desc">
              Exportar todos os dados (clientes e propostas) para um arquivo JSON.
            </span>
          </button>

          <button
            type="button"
            className={`backup-modal__card${selectedAction === 'upload' ? ' backup-modal__card--active' : ''}`}
            onClick={() => setSelectedAction('upload')}
            disabled={isLoading}
          >
            <span className="backup-modal__card-icon" aria-hidden="true">⬆️</span>
            <span className="backup-modal__card-title">Carregar Backup</span>
            <span className="backup-modal__card-desc">
              Restaurar dados a partir de um arquivo JSON gerado anteriormente.
            </span>
          </button>
        </div>

        {/* Destination selector (only for download) */}
        {selectedAction === 'download' && (
          <div className="backup-modal__destino">
            <p className="backup-modal__destino-label">Destino do download:</p>
            <div className="backup-modal__destino-options">
              {DESTINO_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`backup-modal__destino-option${destino === opt.value ? ' backup-modal__destino-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="backup-destino"
                    value={opt.value}
                    checked={destino === opt.value}
                    onChange={() => setDestino(opt.value)}
                    className="backup-modal__destino-radio"
                  />
                  <span className="backup-modal__destino-icon" aria-hidden="true">{opt.icon}</span>
                  <span className="backup-modal__destino-text">
                    <span className="backup-modal__destino-name">{opt.label}</span>
                    <span className="backup-modal__destino-desc">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Warning for upload */}
        {selectedAction === 'upload' && (
          <div className="backup-modal__warning" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>
              <strong>Atenção:</strong> carregar um backup irá mesclar os dados do arquivo com os dados existentes
              na plataforma. Esta operação não pode ser desfeita.
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="backup-modal__footer">
          <button
            type="button"
            className="ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleConfirm}
            disabled={isLoading || selectedAction === null}
            aria-busy={isLoading}
          >
            {isLoading
              ? 'Processando…'
              : selectedAction === 'upload'
                ? 'Escolher arquivo…'
                : selectedAction === 'download'
                  ? 'Gerar backup'
                  : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
