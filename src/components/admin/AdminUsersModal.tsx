import React, { useEffect, useId, useState } from 'react'
import { useAuth, UserRole } from '../../app/auth/AuthProvider'
import { apiFetch, ApiError } from '../../app/services/httpClient'

interface AdminUsersModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AdminUserItem {
  id: string
  email: string
  role: UserRole
  mfaEnabled: boolean
  createdAt: string
  disabledAt?: string | null
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  DIRETOR: 'Diretor',
  INTEGRADOR: 'Integrador',
}

export function AdminUsersModal({ isOpen, onClose }: AdminUsersModalProps) {
  const modalTitleId = useId()
  const { inviteUser, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('INTEGRADOR')
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    void apiFetch<{ users: AdminUserItem[] }>('/admin/users', { method: 'GET', skipCsrf: true })
      .then((response) => {
        setUsers(response.users ?? [])
      })
      .catch((err: unknown) => {
        const apiErr = err as ApiError
        setError(apiErr.message ?? 'Falha ao carregar usuários.')
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleInvite = async () => {
    try {
      setError(null)
      setInviteToken(null)
      const result = await inviteUser({ email: inviteEmail, role: inviteRole })
      setInviteToken(result.token)
      setInviteEmail('')
    } catch (error) {
      const apiError = error as ApiError
      setError(apiError.message ?? 'Não foi possível criar o convite.')
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-content admin-users-modal">
        <div className="modal-header">
          <h3 id={modalTitleId}>Usuários &amp; Perfis</h3>
          <button className="icon" onClick={onClose} aria-label="Fechar gerenciamento de usuários">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <section className="admin-users-section">
            <header className="admin-users-header">
              <h4>Convidar novo usuário</h4>
              <p className="muted">
                Apenas e-mails confiáveis devem ser convidados. Compartilhe o token abaixo via canal seguro.
              </p>
            </header>
            <div className="admin-invite-form">
              <label>
                <span>E-mail corporativo</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="usuario@solarinvest.com"
                />
              </label>
              <label>
                <span>Papel</span>
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)}>
                  <option value="INTEGRADOR">Integrador</option>
                  <option value="DIRETOR">Diretor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <button type="button" className="primary" onClick={handleInvite} disabled={!inviteEmail}>
                Gerar convite
              </button>
            </div>
            {inviteToken ? (
              <div className="admin-invite-token">
                <strong>Token de convite:</strong>
                <code>{inviteToken}</code>
                <p className="muted">
                  Compartilhe este token via canal seguro. Ele expira em 48 horas ou após o primeiro uso.
                </p>
              </div>
            ) : null}
          </section>

          <section className="admin-users-list">
            <header className="admin-users-header">
              <h4>Usuários ativos</h4>
              <p className="muted">Lista de contas habilitadas no painel SolarInvest.</p>
            </header>
            {loading ? (
              <p>Carregando usuários…</p>
            ) : users.length === 0 ? (
              <p className="muted">Nenhum usuário cadastrado além do administrador padrão.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>E-mail</th>
                      <th>Papel</th>
                      <th>MFA</th>
                      <th>Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td>{item.email}</td>
                        <td>{ROLE_LABELS[item.role]}</td>
                        <td>{item.mfaEnabled ? 'Ativo' : 'Pendente'}</td>
                        <td>{new Date(item.createdAt).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {error ? <p className="admin-users-error">{error}</p> : null}
          </section>
          <footer className="admin-users-footer">
            <p className="muted">
              Logado como <strong>{user?.email}</strong>. Use o botão acima para gerar convites e monitore quem já possui acesso.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
