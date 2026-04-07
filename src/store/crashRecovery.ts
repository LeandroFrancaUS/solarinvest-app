/**
 * Detecta se a sessão anterior encerrou abruptamente (crash / kill do processo).
 *
 * A chave 'session_active' é definida em App.tsx durante o mount e removida no
 * beforeunload. Se ainda estiver 'true' ao iniciar, indica que não houve saída
 * limpa — um crash, fechamento forçado de aba ou kill do processo.
 *
 * Usado por useLeasingStore e useVendaStore para decidir se devem restaurar o
 * estado salvo no sessionStorage (crash recovery) ou iniciar com defaults (A.2).
 */
export function isCrashRecovery(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.sessionStorage !== 'undefined' &&
      window.sessionStorage.getItem('session_active') === 'true'
    )
  } catch {
    return false
  }
}
