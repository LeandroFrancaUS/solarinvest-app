import React, { FormEvent, useState } from 'react'
import { useAuth } from './AuthProvider'

type FormMode = 'login' | 'forgot' | 'reset'

export function LoginForm() {
  const { login, verifyMfa, requestPasswordReset, resetPassword } = useAuth()
  const [mode, setMode] = useState<FormMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)

  const changeMode = (nextMode: FormMode) => {
    setMode(nextMode)
    setError(null)
    setInfoMessage(null)
    setSubmitting(false)
    setTotp('')
    if (nextMode !== 'login') {
      setChallengeId(null)
    }
    if (nextMode === 'login') {
      setGeneratedToken(null)
    }
    if (nextMode !== 'reset') {
      setResetToken('')
    }
    setPassword('')
  }

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfoMessage(null)
    setSubmitting(true)
    try {
      if (challengeId) {
        const result = await verifyMfa(challengeId, totp)
        if (!result.success) {
          setError(result.error ?? 'Não foi possível validar o segundo fator.')
        } else {
          setChallengeId(null)
          setTotp('')
          setInfoMessage('Autenticação concluída com sucesso.')
        }
        return
      }
      const result = await login(email, password, totp || undefined)
      if (result.mfaRequired && result.challengeId) {
        setChallengeId(result.challengeId)
        setTotp('')
        setError('Informe o código do segundo fator para continuar.')
        return
      }
      if (!result.success) {
        setError(result.error ?? 'Falha ao autenticar.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfoMessage(null)
    setSubmitting(true)
    try {
      setGeneratedToken(null)
      const response = await requestPasswordReset(email)
      const token = response?.token
      if (token) {
        setGeneratedToken(token)
        changeMode('reset')
        setResetToken(token)
        setInfoMessage('Token de recuperação gerado para ambientes de teste. Use-o para redefinir sua senha.')
      } else {
        setInfoMessage('Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação em instantes.')
      }
    } catch (error) {
      const message = (error as Error).message || 'Não foi possível iniciar a recuperação de senha.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setInfoMessage(null)
    setSubmitting(true)
    try {
      await resetPassword(resetToken, password)
      setGeneratedToken(null)
      changeMode('login')
      setInfoMessage('Senha redefinida com sucesso. Faça login com a nova senha segura.')
    } catch (error) {
      const message = (error as Error).message || 'Não foi possível redefinir a senha.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const isLoginMode = mode === 'login'
  const formSubmitHandler =
    mode === 'login' ? handleLoginSubmit : mode === 'forgot' ? handleForgotSubmit : handleResetSubmit

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={formSubmitHandler}>
        <h1>SolarInvest — Acesso Seguro</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Faça login para acessar o painel de propostas.'
            : mode === 'forgot'
            ? 'Informe seu e-mail corporativo para receber o link de recuperação.'
            : 'Informe o token recebido e defina uma nova senha forte.'}
        </p>
        {mode !== 'reset' ? (
          <label className="auth-field">
            <span>E-mail corporativo</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={submitting || (isLoginMode && Boolean(challengeId))}
            />
          </label>
        ) : null}
        {mode === 'login' ? (
          <label className="auth-field">
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required={!challengeId}
              disabled={submitting || Boolean(challengeId)}
            />
          </label>
        ) : null}
        {challengeId && mode === 'login' ? (
          <label className="auth-field">
            <span>Código MFA</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(event) => setTotp(event.target.value)}
              required
              disabled={submitting}
            />
          </label>
        ) : null}
        {mode === 'forgot' ? (
          <p className="muted small">Você receberá um e-mail com instruções para redefinir sua senha.</p>
        ) : null}
        {mode === 'reset' ? (
          <>
            <label className="auth-field">
              <span>Token de recuperação</span>
              <input
                type="text"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                required
                autoComplete="one-time-code"
                disabled={submitting}
              />
            </label>
            <label className="auth-field">
              <span>Nova senha</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="new-password"
                disabled={submitting}
              />
            </label>
          </>
        ) : null}
        {infoMessage ? (
          <p className="auth-info">
            {infoMessage}
            {generatedToken ? (
              <>
                {' '}
                <span className="auth-token">{generatedToken}</span>
              </>
            ) : null}
          </p>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" className="primary solid" disabled={submitting}>
          {submitting
            ? 'Validando…'
            : mode === 'login'
            ? challengeId
              ? 'Confirmar código'
              : 'Entrar'
            : mode === 'forgot'
            ? 'Enviar instruções'
            : 'Atualizar senha'}
        </button>
        <div className="auth-switcher">
          {mode === 'login' ? (
            <button type="button" className="link" onClick={() => changeMode('forgot')}>
              Esqueceu a senha?
            </button>
          ) : (
            <button type="button" className="link" onClick={() => changeMode('login')}>
              Voltar para o login
            </button>
          )}
          {mode === 'reset' ? (
            <button type="button" className="link" onClick={() => changeMode('forgot')}>
              Precisa de um novo token?
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
