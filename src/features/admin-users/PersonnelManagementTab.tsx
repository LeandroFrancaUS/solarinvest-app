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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PersonnelType = 'consultants' | 'engineers' | 'installers'

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function inputCls(hasError: boolean) {
  return `w-full rounded-lg border ${hasError ? 'border-red-400' : 'border-slate-200'} bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200`
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl max-h-screen overflow-y-auto">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          {editing ? 'Editar Consultor' : 'Adicionar Consultor'}
        </h2>
        {editing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">ID gerado:</span>
            <span className="font-mono font-semibold text-amber-700">{editing.consultant_code}</span>
          </div>
        )}
        {!editing && (
          <p className="mb-4 text-xs text-slate-500 rounded-lg bg-amber-50 px-3 py-2">
            O ID será gerado automaticamente pelo sistema ao salvar.
          </p>
        )}
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className={inputCls(Boolean(errors.full_name))}
            />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CPF/CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
              placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
              className={inputCls(Boolean(errors.document))}
            />
            {errors.document && <p className="mt-1 text-xs text-red-600">{errors.document}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Telefone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputCls(Boolean(errors.phone))}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputCls(Boolean(errors.email))}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <p className="block text-sm font-medium text-slate-700 mb-2">
              Regiões (UF) <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BRAZIL_UFS.map((uf) => (
                <button
                  key={uf}
                  type="button"
                  onClick={() => toggleRegion(uf)}
                  className={`rounded px-2 py-0.5 text-xs font-medium border ${
                    form.regions.includes(uf)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {uf}
                </button>
              ))}
            </div>
            {errors.regions && <p className="mt-1 text-xs text-red-600">{errors.regions}</p>}
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          {editing ? 'Editar Engenheiro' : 'Adicionar Engenheiro'}
        </h2>
        {editing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">ID gerado:</span>
            <span className="font-mono font-semibold text-amber-700">{editing.engineer_code}</span>
          </div>
        )}
        {!editing && (
          <p className="mb-4 text-xs text-slate-500 rounded-lg bg-amber-50 px-3 py-2">
            O ID será gerado automaticamente pelo sistema ao salvar.
          </p>
        )}
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls(Boolean(errors.full_name))} />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CPF/CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
              placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
              className={inputCls(Boolean(errors.document))}
            />
            {errors.document && <p className="mt-1 text-xs text-red-600">{errors.document}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Telefone <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls(Boolean(errors.phone))} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls(Boolean(errors.email))} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CREA <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.crea} onChange={(e) => setForm((f) => ({ ...f, crea: e.target.value }))} placeholder="ex: CREA-SP 123456" className={inputCls(Boolean(errors.crea))} />
            {errors.crea && <p className="mt-1 text-xs text-red-600">{errors.crea}</p>}
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900 mb-4">
          {editing ? 'Editar Instalador' : 'Adicionar Instalador'}
        </h2>
        {editing && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">ID gerado:</span>
            <span className="font-mono font-semibold text-amber-700">{editing.installer_code}</span>
          </div>
        )}
        {!editing && (
          <p className="mb-4 text-xs text-slate-500 rounded-lg bg-amber-50 px-3 py-2">
            O ID será gerado automaticamente pelo sistema ao salvar.
          </p>
        )}
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input type="text" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls(Boolean(errors.full_name))} />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              CPF/CNPJ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
              placeholder="ex: 123.456.789-00 ou 12.345.678/0001-99"
              className={inputCls(Boolean(errors.document))}
            />
            {errors.document && <p className="mt-1 text-xs text-red-600">{errors.document}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Telefone <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls(Boolean(errors.phone))} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls(Boolean(errors.email))} />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Desativar</h2>
        <p className="text-sm text-slate-600 mb-4">
          Desativar <strong>{name}</strong>? O registro será preservado para histórico, mas não aparecerá em novos cadastros.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
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
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          ＋ Adicionar Consultor
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">ID</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Nome</th>
              <th className="px-4 py-3 font-semibold text-slate-600">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Telefone</th>
              <th className="px-4 py-3 font-semibold text-slate-600">E-mail</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Regiões</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Nenhum consultor encontrado.</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.consultant_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{c.document ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{(c.regions ?? []).join(', ') || '—'}</td>
                  <td className="px-4 py-3"><ActiveBadge active={c.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(c); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Editar
                      </button>
                      {c.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(c)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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
      <p className="mt-2 text-xs text-slate-400">{filtered.length} consultor(es)</p>
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
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          ＋ Adicionar Engenheiro
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">ID</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Nome</th>
              <th className="px-4 py-3 font-semibold text-slate-600">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Telefone</th>
              <th className="px-4 py-3 font-semibold text-slate-600">E-mail</th>
              <th className="px-4 py-3 font-semibold text-slate-600">CREA</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Nenhum engenheiro encontrado.</td></tr>
            ) : (
              filtered.map((eng) => (
                <tr key={eng.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{eng.engineer_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{eng.full_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{eng.document ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{eng.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{eng.email}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{eng.crea}</td>
                  <td className="px-4 py-3"><ActiveBadge active={eng.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(eng); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Editar
                      </button>
                      {eng.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(eng)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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
      <p className="mt-2 text-xs text-slate-400">{filtered.length} engenheiro(s)</p>
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
          <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          ＋ Adicionar Instalador
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">ID</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Nome</th>
              <th className="px-4 py-3 font-semibold text-slate-600">CPF/CNPJ</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Telefone</th>
              <th className="px-4 py-3 font-semibold text-slate-600">E-mail</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Nenhum instalador encontrado.</td></tr>
            ) : (
              filtered.map((ins) => (
                <tr key={ins.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{ins.installer_code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{ins.full_name}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{ins.document ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{ins.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{ins.email}</td>
                  <td className="px-4 py-3"><ActiveBadge active={ins.is_active} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditing(ins); setShowModal(true) }}
                        className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Editar
                      </button>
                      {ins.is_active && (
                        <button
                          type="button"
                          onClick={() => setDeactivating(ins)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
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
      <p className="mt-2 text-xs text-slate-400">{filtered.length} instalador(es)</p>
    </div>
  )
}
