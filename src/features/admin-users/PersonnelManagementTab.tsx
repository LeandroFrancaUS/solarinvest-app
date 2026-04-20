// src/features/admin-users/PersonnelManagementTab.tsx
// Generic management tab for Consultants, Engineers, and Installers.
// Provides list, add, edit, and deactivate operations with field validation.

import React, { useState, useEffect, useCallback } from 'react'
import { BRAZIL_UFS } from '../../types/personnel'
import type {
  Consultant,
  Engineer,
  Installer,
  CreateConsultantRequest,
  UpdateConsultantRequest,
  CreateEngineerRequest,
  UpdateEngineerRequest,
  CreateInstallerRequest,
  UpdateInstallerRequest,
} from '../../types/personnel'
import {
  fetchConsultants,
  createConsultant,
  updateConsultant,
  deactivateConsultant,
  fetchEngineers,
  createEngineer,
  updateEngineer,
  deactivateEngineer,
  fetchInstallers,
  createInstaller,
  updateInstaller,
  deactivateInstaller,
} from '../../services/personnelApi'
import { ImportFromExistingModal, type ImportSource, type ImportRecord } from './ImportFromExistingModal'
import type { ImportableUser, ImportableClient } from '../../services/personnelImport'
import {
  mapUserToConsultantDraft,
  mapClientToConsultantDraft,
  mapUserToEngineerDraft,
  mapClientToEngineerDraft,
  mapUserToInstallerDraft,
  mapClientToInstallerDraft,
} from './personnelImportMappers'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PersonnelType = 'consultants' | 'engineers' | 'installers'

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-[var(--color-success-bg)] text-ds-success' : 'bg-ds-ghost text-ds-text-muted'}`}>
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function inputCls(hasError: boolean) {
  return `w-full rounded-lg border ${hasError ? 'border-ds-danger' : 'border-ds-border'} bg-ds-input-bg text-ds-text-primary px-3 py-2 text-sm placeholder:text-ds-text-muted focus:border-ds-primary focus:outline-none focus:ring-2 focus:ring-[var(--input-focus-ring)]`
}

// ─────────────────────────────────────────────────────────────────────────────
// Overwrite confirmation dialog (shared by all three modals)
// ─────────────────────────────────────────────────────────────────────────────

function OverwriteConfirmDialog({
  onFillEmpty,
  onOverwrite,
  onCancel,
}: {
  onFillEmpty: () => void
  onOverwrite: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-ds-border bg-ds-surface p-6 shadow-2xl">
        <h3 className="text-sm font-semibold text-ds-text-primary mb-2">Campos já preenchidos</h3>
        <p className="text-sm text-ds-text-secondary mb-5">
          Deseja importar apenas os campos vazios ou substituir os dados já preenchidos?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onFillEmpty}
            className="w-full rounded-lg bg-ds-primary px-4 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover"
          >
            Preencher apenas campos vazios
          </button>
          <button
            type="button"
            onClick={onOverwrite}
            className="w-full rounded-lg border border-ds-border px-4 py-2 text-sm font-medium text-ds-text-secondary hover:bg-ds-ghost-hover"
          >
            Substituir dados existentes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg px-4 py-2 text-sm text-ds-text-muted hover:text-ds-text-primary"
          >
            Cancelar importação
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultants form/modal
// ─────────────────────────────────────────────────────────────────────────────

interface ConsultantFormState {
  full_name: string
  phone: string
  email: string
  document: string
  regions: string[]
}

const emptyConsultantForm = (): ConsultantFormState => ({
  full_name: '',
  phone: '',
  email: '',
  document: '',
  regions: [],
})

function ConsultantModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Consultant | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ConsultantFormState>(
    editing
      ? {
          full_name: editing.full_name,
          phone: editing.phone,
          email: editing.email,
          document: editing.document ?? '',
          regions: editing.regions ?? [],
        }
      : emptyConsultantForm(),
  )
  const [errors, setErrors] = useState<Partial<Record<keyof ConsultantFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Import state ──────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<Partial<ConsultantFormState> | null>(null)

  function isFormEmpty(): boolean {
    return !form.full_name && !form.phone && !form.email
  }

  function applyDraft(draft: Partial<ConsultantFormState>) {
    setForm((f) => ({
      full_name: draft.full_name !== undefined ? draft.full_name : f.full_name,
      phone:     draft.phone     !== undefined ? draft.phone     : f.phone,
      email:     draft.email     !== undefined ? draft.email     : f.email,
      document:  draft.document  !== undefined ? draft.document  : f.document,
      regions:   draft.regions   !== undefined && draft.regions.length > 0 ? draft.regions : f.regions,
    }))
  }

  function handleImport(source: ImportSource, record: ImportRecord) {
    const draft =
      source === 'users'
        ? mapUserToConsultantDraft(record as ImportableUser)
        : mapClientToConsultantDraft(record as ImportableClient)

    setShowImportModal(false)

    if (isFormEmpty()) {
      // Nothing filled yet — apply directly
      applyDraft(draft)
    } else {
      // Ask if existing data should be overwritten
      setPendingDraft(draft)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.full_name.trim()) e.full_name = 'Nome é obrigatório.'
    if (!form.phone.trim()) e.phone = 'Telefone é obrigatório.'
    if (!form.email.trim()) e.email = 'E-mail é obrigatório.'
    if (!form.document.trim()) e.document = 'CPF/CNPJ é obrigatório.'
    if (form.regions.length === 0) e.regions = 'Selecione ao menos uma UF.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function toggleRegion(uf: string) {
    setForm((f) => ({
      ...f,
      regions: f.regions.includes(uf) ? f.regions.filter((r) => r !== uf) : [...f.regions, uf],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        const payload: UpdateConsultantRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          document: form.document,
          regions: form.regions,
        }
        await updateConsultant(editing.id, payload)
      } else {
        const payload: CreateConsultantRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          document: form.document,
          regions: form.regions,
        }
        await createConsultant(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar consultor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showImportModal && (
        <ImportFromExistingModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {pendingDraft && (
        <OverwriteConfirmDialog
          onFillEmpty={() => {
            if (pendingDraft) {
              // Only fill in fields that are currently blank
              setForm((f) => ({
                full_name: f.full_name.trim() ? f.full_name : (pendingDraft.full_name ?? f.full_name),
                phone:     f.phone.trim()     ? f.phone     : (pendingDraft.phone     ?? f.phone),
                email:     f.email.trim()     ? f.email     : (pendingDraft.email     ?? f.email),
                document:  f.document.trim()  ? f.document  : (pendingDraft.document  ?? f.document),
                regions:   f.regions.length > 0 ? f.regions : (pendingDraft.regions   ?? f.regions),
              }))
            }
            setPendingDraft(null)
          }}
          onOverwrite={() => {
            if (pendingDraft) applyDraft(pendingDraft)
            setPendingDraft(null)
          }}
          onCancel={() => setPendingDraft(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
        <div className="mx-4 w-full max-w-lg rounded-xl border border-ds-border bg-ds-surface p-6 shadow-xl max-h-screen overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ds-text-primary">
              {editing ? 'Editar Consultor' : 'Adicionar Consultor'}
            </h2>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="rounded-lg border border-ds-border px-2.5 py-1.5 text-xs font-medium text-ds-text-secondary hover:bg-ds-ghost-hover hover:border-ds-primary flex items-center gap-1"
                title="Importar dados de usuário ou cliente existente"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Importar dados
              </button>
            </div>
          </div>
          {editing && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-ds-ghost px-3 py-2 text-sm">
              <span className="text-ds-text-muted">ID gerado:</span>
              <span className="font-mono font-semibold text-ds-primary">{editing.consultant_code}</span>
            </div>
          )}
          {!editing && (
            <p className="mb-4 text-xs text-ds-text-muted rounded-lg bg-ds-primary-soft px-3 py-2">
              O ID será gerado automaticamente pelo sistema ao salvar.
            </p>
          )}
          <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Nome completo <span className="text-ds-danger">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className={inputCls(Boolean(errors.full_name))}
              />
              {errors.full_name && <p className="mt-1 text-xs text-ds-danger">{errors.full_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                CPF/CNPJ <span className="text-ds-danger">*</span>
              </label>
              <input
                type="text"
                value={form.document}
                onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
                className={inputCls(Boolean(errors.document))}
              />
              {errors.document && <p className="mt-1 text-xs text-ds-danger">{errors.document}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Telefone <span className="text-ds-danger">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputCls(Boolean(errors.phone))}
              />
              {errors.phone && <p className="mt-1 text-xs text-ds-danger">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                E-mail <span className="text-ds-danger">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputCls(Boolean(errors.email))}
              />
              {errors.email && <p className="mt-1 text-xs text-ds-danger">{errors.email}</p>}
            </div>
            <div>
              <p className="block text-sm font-medium text-ds-text-secondary mb-2">
                Regiões (UF) <span className="text-ds-danger">*</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BRAZIL_UFS.map((uf) => (
                  <button
                    key={uf}
                    type="button"
                    onClick={() => toggleRegion(uf)}
                    className={`rounded px-2 py-0.5 text-xs font-medium border ${
                      form.regions.includes(uf)
                        ? 'bg-ds-primary text-white border-ds-primary'
                        : 'bg-ds-surface text-ds-text-secondary border-ds-border hover:border-ds-primary'
                    }`}
                  >
                    {uf}
                  </button>
                ))}
              </div>
              {errors.regions && <p className="mt-1 text-xs text-ds-danger">{errors.regions}</p>}
            </div>
            {saveError && (
              <p className="rounded-lg bg-[var(--color-error-bg)] px-3 py-2 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{saveError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-ds-border px-4 py-2 text-sm font-medium text-ds-text-secondary hover:bg-ds-ghost-hover disabled:opacity-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-ds-primary px-4 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineers form/modal
// ─────────────────────────────────────────────────────────────────────────────

interface EngineerFormState {
  full_name: string
  phone: string
  email: string
  crea: string
  document: string
}

const emptyEngineerForm = (): EngineerFormState => ({
  full_name: '',
  phone: '',
  email: '',
  crea: '',
  document: '',
})

function EngineerModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Engineer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EngineerFormState>(
    editing
      ? {
          full_name: editing.full_name,
          phone: editing.phone,
          email: editing.email,
          crea: editing.crea,
          document: editing.document ?? '',
        }
      : emptyEngineerForm(),
  )
  const [errors, setErrors] = useState<Partial<Record<keyof EngineerFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Import state ──────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<Partial<EngineerFormState> | null>(null)

  function isFormEmpty(): boolean {
    return !form.full_name && !form.phone && !form.email
  }

  function applyDraft(draft: Partial<EngineerFormState>) {
    setForm((f) => ({
      full_name: draft.full_name !== undefined ? draft.full_name : f.full_name,
      phone:     draft.phone     !== undefined ? draft.phone     : f.phone,
      email:     draft.email     !== undefined ? draft.email     : f.email,
      crea:      f.crea, // CREA is never imported — always keep existing value
      document:  draft.document  !== undefined ? draft.document  : f.document,
    }))
  }

  function handleImport(source: ImportSource, record: ImportRecord) {
    const draft =
      source === 'users'
        ? mapUserToEngineerDraft(record as ImportableUser)
        : mapClientToEngineerDraft(record as ImportableClient)

    setShowImportModal(false)

    if (isFormEmpty()) {
      applyDraft(draft)
    } else {
      setPendingDraft(draft)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.full_name.trim()) e.full_name = 'Nome é obrigatório.'
    if (!form.phone.trim()) e.phone = 'Telefone é obrigatório.'
    if (!form.email.trim()) e.email = 'E-mail é obrigatório.'
    if (!form.crea.trim()) e.crea = 'CREA é obrigatório.'
    if (!form.document.trim()) e.document = 'CPF/CNPJ é obrigatório.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        const payload: UpdateEngineerRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          crea: form.crea,
          document: form.document,
        }
        await updateEngineer(editing.id, payload)
      } else {
        const payload: CreateEngineerRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          crea: form.crea,
          document: form.document,
        }
        await createEngineer(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar engenheiro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showImportModal && (
        <ImportFromExistingModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {pendingDraft && (
        <OverwriteConfirmDialog
          onFillEmpty={() => {
            if (pendingDraft) {
              setForm((f) => ({
                full_name: f.full_name.trim() ? f.full_name : (pendingDraft.full_name ?? f.full_name),
                phone:     f.phone.trim()     ? f.phone     : (pendingDraft.phone     ?? f.phone),
                email:     f.email.trim()     ? f.email     : (pendingDraft.email     ?? f.email),
                crea:      f.crea, // never overwrite CREA
                document:  f.document.trim()  ? f.document  : (pendingDraft.document  ?? f.document),
              }))
            }
            setPendingDraft(null)
          }}
          onOverwrite={() => {
            if (pendingDraft) applyDraft(pendingDraft)
            setPendingDraft(null)
          }}
          onCancel={() => setPendingDraft(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
        <div className="mx-4 w-full max-w-lg rounded-xl border border-ds-border bg-ds-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ds-text-primary">
              {editing ? 'Editar Engenheiro' : 'Adicionar Engenheiro'}
            </h2>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="rounded-lg border border-ds-border px-2.5 py-1.5 text-xs font-medium text-ds-text-secondary hover:bg-ds-ghost-hover hover:border-ds-primary flex items-center gap-1"
              title="Importar dados de usuário ou cliente existente"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Importar dados
            </button>
          </div>
          {editing && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-ds-ghost px-3 py-2 text-sm">
              <span className="text-ds-text-muted">ID gerado:</span>
              <span className="font-mono font-semibold text-ds-primary">{editing.engineer_code}</span>
            </div>
          )}
          {!editing && (
            <p className="mb-4 text-xs text-ds-text-muted rounded-lg bg-ds-primary-soft px-3 py-2">
              O ID será gerado automaticamente pelo sistema ao salvar.
            </p>
          )}
          <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Nome completo <span className="text-ds-danger">*</span>
              </label>
              <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls(Boolean(errors.full_name))} />
              {errors.full_name && <p className="mt-1 text-xs text-ds-danger">{errors.full_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                CPF/CNPJ <span className="text-ds-danger">*</span>
              </label>
              <input
                type="text"
                value={form.document}
                onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
                className={inputCls(Boolean(errors.document))}
              />
              {errors.document && <p className="mt-1 text-xs text-ds-danger">{errors.document}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Telefone <span className="text-ds-danger">*</span>
              </label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls(Boolean(errors.phone))} />
              {errors.phone && <p className="mt-1 text-xs text-ds-danger">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                E-mail <span className="text-ds-danger">*</span>
              </label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls(Boolean(errors.email))} />
              {errors.email && <p className="mt-1 text-xs text-ds-danger">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                CREA <span className="text-ds-danger">*</span>
              </label>
              <input type="text" value={form.crea} onChange={(e) => setForm((f) => ({ ...f, crea: e.target.value }))} placeholder="ex: CREA-SP 123456" className={inputCls(Boolean(errors.crea))} />
              {errors.crea && <p className="mt-1 text-xs text-ds-danger">{errors.crea}</p>}
            </div>
            {saveError && (
              <p className="rounded-lg bg-[var(--color-error-bg)] px-3 py-2 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{saveError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-ds-border px-4 py-2 text-sm font-medium text-ds-text-secondary hover:bg-ds-ghost-hover disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-ds-primary px-4 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Installers form/modal
// ─────────────────────────────────────────────────────────────────────────────

interface InstallerFormState {
  full_name: string
  phone: string
  email: string
  document: string
}

const emptyInstallerForm = (): InstallerFormState => ({
  full_name: '',
  phone: '',
  email: '',
  document: '',
})

function InstallerModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Installer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<InstallerFormState>(
    editing
      ? {
          full_name: editing.full_name,
          phone: editing.phone,
          email: editing.email,
          document: editing.document ?? '',
        }
      : emptyInstallerForm(),
  )
  const [errors, setErrors] = useState<Partial<Record<keyof InstallerFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Import state ──────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<Partial<InstallerFormState> | null>(null)

  function isFormEmpty(): boolean {
    return !form.full_name && !form.phone && !form.email
  }

  function applyDraft(draft: Partial<InstallerFormState>) {
    setForm((f) => ({
      full_name: draft.full_name !== undefined ? draft.full_name : f.full_name,
      phone:     draft.phone     !== undefined ? draft.phone     : f.phone,
      email:     draft.email     !== undefined ? draft.email     : f.email,
      document:  draft.document  !== undefined ? draft.document  : f.document,
    }))
  }

  function handleImport(source: ImportSource, record: ImportRecord) {
    const draft =
      source === 'users'
        ? mapUserToInstallerDraft(record as ImportableUser)
        : mapClientToInstallerDraft(record as ImportableClient)

    setShowImportModal(false)

    if (isFormEmpty()) {
      applyDraft(draft)
    } else {
      setPendingDraft(draft)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.full_name.trim()) e.full_name = 'Nome é obrigatório.'
    if (!form.phone.trim()) e.phone = 'Telefone é obrigatório.'
    if (!form.email.trim()) e.email = 'E-mail é obrigatório.'
    if (!form.document.trim()) e.document = 'CPF/CNPJ é obrigatório.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editing) {
        const payload: UpdateInstallerRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          document: form.document,
        }
        await updateInstaller(editing.id, payload)
      } else {
        const payload: CreateInstallerRequest = {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          document: form.document,
        }
        await createInstaller(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar instalador.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showImportModal && (
        <ImportFromExistingModal
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {pendingDraft && (
        <OverwriteConfirmDialog
          onFillEmpty={() => {
            if (pendingDraft) {
              setForm((f) => ({
                full_name: f.full_name.trim() ? f.full_name : (pendingDraft.full_name ?? f.full_name),
                phone:     f.phone.trim()     ? f.phone     : (pendingDraft.phone     ?? f.phone),
                email:     f.email.trim()     ? f.email     : (pendingDraft.email     ?? f.email),
                document:  f.document.trim()  ? f.document  : (pendingDraft.document  ?? f.document),
              }))
            }
            setPendingDraft(null)
          }}
          onOverwrite={() => {
            if (pendingDraft) applyDraft(pendingDraft)
            setPendingDraft(null)
          }}
          onCancel={() => setPendingDraft(null)}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
        <div className="mx-4 w-full max-w-lg rounded-xl border border-ds-border bg-ds-surface p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ds-text-primary">
              {editing ? 'Editar Instalador' : 'Adicionar Instalador'}
            </h2>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="rounded-lg border border-ds-border px-2.5 py-1.5 text-xs font-medium text-ds-text-secondary hover:bg-ds-ghost-hover hover:border-ds-primary flex items-center gap-1"
              title="Importar dados de usuário ou cliente existente"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Importar dados
            </button>
          </div>
          {editing && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-ds-ghost px-3 py-2 text-sm">
              <span className="text-ds-text-muted">ID gerado:</span>
              <span className="font-mono font-semibold text-ds-primary">{editing.installer_code}</span>
            </div>
          )}
          {!editing && (
            <p className="mb-4 text-xs text-ds-text-muted rounded-lg bg-ds-primary-soft px-3 py-2">
              O ID será gerado automaticamente pelo sistema ao salvar.
            </p>
          )}
          <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Nome completo <span className="text-ds-danger">*</span>
              </label>
              <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls(Boolean(errors.full_name))} />
              {errors.full_name && <p className="mt-1 text-xs text-ds-danger">{errors.full_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                CPF/CNPJ <span className="text-ds-danger">*</span>
              </label>
              <input
                type="text"
                value={form.document}
                onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
                placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
                className={inputCls(Boolean(errors.document))}
              />
              {errors.document && <p className="mt-1 text-xs text-ds-danger">{errors.document}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                Telefone <span className="text-ds-danger">*</span>
              </label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls(Boolean(errors.phone))} />
              {errors.phone && <p className="mt-1 text-xs text-ds-danger">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-ds-text-secondary mb-1">
                E-mail <span className="text-ds-danger">*</span>
              </label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls(Boolean(errors.email))} />
              {errors.email && <p className="mt-1 text-xs text-ds-danger">{errors.email}</p>}
            </div>
            {saveError && (
              <p className="rounded-lg bg-[var(--color-error-bg)] px-3 py-2 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{saveError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-ds-border px-4 py-2 text-sm font-medium text-ds-text-secondary hover:bg-ds-ghost-hover disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-ds-primary px-4 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm deactivate modal
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDeactivateModal({
  name,
  onConfirm,
  onCancel,
  loading,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-ds-border bg-ds-surface p-6 shadow-xl">
        <h2 className="text-base font-semibold text-ds-text-primary mb-2">Desativar</h2>
        <p className="text-sm text-ds-text-secondary mb-4">
          Desativar <strong>{name}</strong>? O registro será preservado para histórico, mas não aparecerá em novos cadastros.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border border-ds-border px-4 py-2 text-sm font-medium text-ds-text-secondary hover:bg-ds-ghost-hover disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-lg bg-ds-danger px-4 py-2 text-sm font-medium text-white hover:bg-ds-danger-hover disabled:opacity-50">
            {loading ? 'Desativando...' : 'Desativar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Consultants Tab
// ─────────────────────────────────────────────────────────────────────────────

export function ConsultantsTab() {
  const [items, setItems] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Consultant | null>(null)
  const [deactivating, setDeactivating] = useState<Consultant | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchConsultants()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar consultores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = items.filter((c) => {
    const q = search.toLowerCase()
    return (
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.consultant_code.toLowerCase().includes(q) ||
      (c.document ?? '').toLowerCase().includes(q) ||
      (c.regions ?? []).some((r) => r.toLowerCase().includes(q))
    )
  })

  async function handleDeactivate() {
    if (!deactivating) return
    setDeactivateLoading(true)
    try {
      await deactivateConsultant(deactivating.id)
      setDeactivating(null)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar consultor.')
      setDeactivating(null)
    } finally {
      setDeactivateLoading(false)
    }
  }

  return (
    <div>
      {showModal && (
        <ConsultantModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { void load() }}
        />
      )}
      {deactivating && (
        <ConfirmDeactivateModal
          name={deactivating.full_name}
          onConfirm={() => { void handleDeactivate() }}
          onCancel={() => setDeactivating(null)}
          loading={deactivateLoading}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <input
            type="search"
            placeholder="Buscar por nome, e-mail, código ou UF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 pl-9 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-ds-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover"
        >
          ＋ Adicionar Consultor
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-[var(--color-error-bg)] px-4 py-3 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ds-border">
        <table className="w-full text-sm">
          <thead className="bg-ds-table-header text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">ID</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Nome</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Telefone</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">E-mail</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Regiões</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Status</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ds-text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ds-text-muted">Nenhum consultor encontrado.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-ds-table-hover">
                  <td className="px-4 py-3 font-mono text-xs text-ds-text-muted">{c.consultant_code}</td>
                  <td className="px-4 py-3 font-medium text-ds-text-primary">{c.full_name}</td>
                  <td className="px-4 py-3 text-ds-text-secondary text-xs">{c.document ?? '—'}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{c.phone}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{c.email}</td>
                  <td className="px-4 py-3 text-ds-text-secondary text-xs">{(c.regions ?? []).join(', ') || '—'}</td>
                  <td className="px-4 py-3"><ActiveBadge active={c.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(c); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-ds-primary hover:bg-ds-primary-soft"
                      >
                        Editar
                      </button>
                      {c.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(c)}
                          className="rounded px-2 py-1 text-xs font-medium text-ds-danger hover:bg-ds-ghost"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ds-text-muted">{filtered.length} consultor(es)</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Engineers Tab
// ─────────────────────────────────────────────────────────────────────────────

export function EngineersTab() {
  const [items, setItems] = useState<Engineer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Engineer | null>(null)
  const [deactivating, setDeactivating] = useState<Engineer | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchEngineers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar engenheiros.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = items.filter((e) => {
    const q = search.toLowerCase()
    return (
      !q ||
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.engineer_code.toLowerCase().includes(q) ||
      e.crea.toLowerCase().includes(q) ||
      (e.document ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDeactivate() {
    if (!deactivating) return
    setDeactivateLoading(true)
    try {
      await deactivateEngineer(deactivating.id)
      setDeactivating(null)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar engenheiro.')
      setDeactivating(null)
    } finally {
      setDeactivateLoading(false)
    }
  }

  return (
    <div>
      {showModal && (
        <EngineerModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { void load() }}
        />
      )}
      {deactivating && (
        <ConfirmDeactivateModal
          name={deactivating.full_name}
          onConfirm={() => { void handleDeactivate() }}
          onCancel={() => setDeactivating(null)}
          loading={deactivateLoading}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <input
            type="search"
            placeholder="Buscar por nome, e-mail, CREA ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 pl-9 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-ds-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover"
        >
          ＋ Adicionar Engenheiro
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-[var(--color-error-bg)] px-4 py-3 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ds-border">
        <table className="w-full text-sm">
          <thead className="bg-ds-table-header text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">ID</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Nome</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Telefone</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">E-mail</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">CREA</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Status</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ds-text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-ds-text-muted">Nenhum engenheiro encontrado.</td></tr>
            ) : (
              filtered.map((eng) => (
                <tr key={eng.id} className="hover:bg-ds-table-hover">
                  <td className="px-4 py-3 font-mono text-xs text-ds-text-muted">{eng.engineer_code}</td>
                  <td className="px-4 py-3 font-medium text-ds-text-primary">{eng.full_name}</td>
                  <td className="px-4 py-3 text-ds-text-secondary text-xs">{eng.document ?? '—'}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{eng.phone}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{eng.email}</td>
                  <td className="px-4 py-3 text-ds-text-secondary text-xs">{eng.crea}</td>
                  <td className="px-4 py-3"><ActiveBadge active={eng.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(eng); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-ds-primary hover:bg-ds-primary-soft"
                      >
                        Editar
                      </button>
                      {eng.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(eng)}
                          className="rounded px-2 py-1 text-xs font-medium text-ds-danger hover:bg-ds-ghost"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ds-text-muted">{filtered.length} engenheiro(s)</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Installers Tab
// ─────────────────────────────────────────────────────────────────────────────

export function InstallersTab() {
  const [items, setItems] = useState<Installer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Installer | null>(null)
  const [deactivating, setDeactivating] = useState<Installer | null>(null)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchInstallers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar instaladores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = items.filter((i) => {
    const q = search.toLowerCase()
    return (
      !q ||
      i.full_name.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      i.installer_code.toLowerCase().includes(q) ||
      (i.document ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDeactivate() {
    if (!deactivating) return
    setDeactivateLoading(true)
    try {
      await deactivateInstaller(deactivating.id)
      setDeactivating(null)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar instalador.')
      setDeactivating(null)
    } finally {
      setDeactivateLoading(false)
    }
  }

  return (
    <div>
      {showModal && (
        <InstallerModal
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { void load() }}
        />
      )}
      {deactivating && (
        <ConfirmDeactivateModal
          name={deactivating.full_name}
          onConfirm={() => { void handleDeactivate() }}
          onCancel={() => setDeactivating(null)}
          loading={deactivateLoading}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <input
            type="search"
            placeholder="Buscar por nome, e-mail ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 pl-9 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-ds-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:bg-ds-primary-hover"
        >
          ＋ Adicionar Instalador
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-[var(--color-error-bg)] px-4 py-3 text-sm text-ds-danger ring-1 ring-[var(--color-error-border)]">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-ds-border">
        <table className="w-full text-sm">
          <thead className="bg-ds-table-header text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">ID</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Nome</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Telefone</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">E-mail</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Status</th>
              <th className="px-4 py-3 font-semibold text-ds-text-secondary">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ds-text-muted">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-ds-text-muted">Nenhum instalador encontrado.</td></tr>
            ) : (
              filtered.map((ins) => (
                <tr key={ins.id} className="hover:bg-ds-table-hover">
                  <td className="px-4 py-3 font-mono text-xs text-ds-text-muted">{ins.installer_code}</td>
                  <td className="px-4 py-3 font-medium text-ds-text-primary">{ins.full_name}</td>
                  <td className="px-4 py-3 text-ds-text-secondary text-xs">{ins.document ?? '—'}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{ins.phone}</td>
                  <td className="px-4 py-3 text-ds-text-secondary">{ins.email}</td>
                  <td className="px-4 py-3"><ActiveBadge active={ins.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(ins); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-ds-primary hover:bg-ds-primary-soft"
                      >
                        Editar
                      </button>
                      {ins.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(ins)}
                          className="rounded px-2 py-1 text-xs font-medium text-ds-danger hover:bg-ds-ghost"
                        >
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ds-text-muted">{filtered.length} instalador(es)</p>
    </div>
  )
}
