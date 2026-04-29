// src/pages/PrecheckModal.tsx
// Modal dialog for normative pre-check (padrão de entrada). Rendered at the app root
// so it overlays any page. Receives all state as props; no local side-effects.

import { CheckboxSmall } from '../components/CheckboxSmall'
import { formatNumberBRWithOptions } from '../lib/locale/br-number'
import {
  formatTipoLigacaoLabel,
  type NormComplianceResult,
  type NormComplianceStatus,
  type PrecheckDecision,
} from '../domain/normas/padraoEntradaRules'

export type PrecheckModalProps = {
  data: NormComplianceResult
  clienteCiente: boolean
  setClienteCiente: (value: boolean) => void
  onDecision: (decision: PrecheckDecision) => void
}

export function PrecheckModal({ data, clienteCiente, setClienteCiente, onDecision }: PrecheckModalProps) {
  const isFora = data.status === 'FORA_DA_NORMA'
  const isLimitado = data.status === 'LIMITADO'
  const isWarning = data.status === 'WARNING'
  const tipoLabel = formatTipoLigacaoLabel(data.tipoLigacao)
  const limiteAtual = data.kwMaxPermitido
  const upgradeLabel = data.upgradeTo ? formatTipoLigacaoLabel(data.upgradeTo) : null
  const limiteUpgrade = data.kwMaxUpgrade

  const formatKw = (value?: number | null) =>
    value != null
      ? formatNumberBRWithOptions(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : null

  const potenciaLabel = formatKw(data.potenciaInversorKw) ?? '—'
  const limiteAtualLabel = formatKw(limiteAtual)
  const limiteUpgradeLabel = formatKw(limiteUpgrade)

  const canAdjustCurrent = Boolean(limiteAtual)
  const isAboveLimit = data.status === 'FORA_DA_NORMA' || data.status === 'LIMITADO'
  const canAdjustUpgrade = Boolean(upgradeLabel && limiteUpgrade)

  const statusMessageMap: Record<NormComplianceStatus, string> = {
    OK: 'Dentro do limite do padrão informado.',
    WARNING:
      'Regra provisória: valide com a distribuidora antes do envio. Você pode continuar, mas recomendamos confirmar o padrão.',
    FORA_DA_NORMA:
      'A potência informada está acima do limite do padrão atual. Você pode ajustar para o limite atual ou simular o upgrade do padrão.',
    LIMITADO:
      'A potência informada excede o limite do padrão atual e também o limite do próximo upgrade. É necessário adequar a potência/projeto.',
  }

  return (
    <div className="modal precheck-modal" role="dialog" aria-modal="true">
      <div
        className="modal-backdrop precheck-modal__backdrop"
        onClick={() => onDecision({ action: 'cancel', clienteCiente: false })}
        aria-hidden="true"
      />
      <div className="modal-content precheck-modal__content">
        <div className="modal-header">
          <div>
            <h3>Pré-check normativo (padrão de entrada)</h3>
            <p className="muted">
              UF: {data.uf} • Padrão atual: {tipoLabel} • Potência informada: {potenciaLabel} kW
            </p>
          </div>
          <button
            type="button"
            className="icon"
            onClick={() => onDecision({ action: 'cancel', clienteCiente: false })}
            aria-label="Fechar pré-check normativo"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>{statusMessageMap[data.status]}</p>
          <div className="precheck-modal__limits">
            <ul>
              <li>Limite do padrão atual: {limiteAtualLabel ? `${limiteAtualLabel} kW` : '—'}</li>
              {isAboveLimit && upgradeLabel && limiteUpgradeLabel ? (
                <li>
                  Upgrade sugerido: {upgradeLabel} (até {limiteUpgradeLabel} kW)
                </li>
              ) : (
                <li>Sem upgrade sugerido para este caso.</li>
              )}
            </ul>
          </div>
          {isFora ? (
            <label className="precheck-modal__ack">
              <CheckboxSmall
                checked={clienteCiente}
                onChange={(event) => setClienteCiente(event.target.checked)}
              />
              <span>
                Cliente ciente. A SolarInvest seguirá com a proposta, e o cliente se compromete a adequar o padrão
                junto à distribuidora.
              </span>
            </label>
          ) : null}
          {isLimitado ? (
            <p className="muted">Este cenário exige ajuste antes de gerar a proposta.</p>
          ) : null}
          {isWarning ? (
            <p className="muted">Você pode continuar, mas recomendamos confirmar a regra com a distribuidora.</p>
          ) : null}
        </div>
        <div className="modal-actions precheck-modal__actions">
          {canAdjustCurrent ? (
            <button
              type="button"
              className="primary"
              onClick={() => onDecision({ action: 'adjust_current', clienteCiente })}
            >
              Ajustar para {limiteAtualLabel} kW
            </button>
          ) : null}
          {canAdjustUpgrade ? (
            <button
              type="button"
              className="primary"
              onClick={() => onDecision({ action: 'adjust_upgrade', clienteCiente })}
            >
              Upgrade para {upgradeLabel} ({limiteUpgradeLabel} kW)
            </button>
          ) : null}
          {isFora ? (
            <button
              type="button"
              className="ghost"
              disabled={!clienteCiente}
              title={clienteCiente ? undefined : 'Marque cliente ciente para continuar sem ajuste'}
              onClick={() => onDecision({ action: 'proceed', clienteCiente })}
            >
              Gerar sem ajuste
            </button>
          ) : null}
          <button
            type="button"
            className="ghost"
            onClick={() => onDecision({ action: 'cancel', clienteCiente: false })}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}
