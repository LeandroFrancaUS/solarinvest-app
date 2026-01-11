import { getStackUser, isStackAuthEnabled, sanitizeStackUserId } from '../auth/stackAuth.js'

/**
 * Middleware para exigir autenticação Stack Auth.
 * Se Stack Auth não estiver configurado, permite acesso sem autenticação (fallback mode).
 * Se Stack Auth estiver configurado, rejeita requisições sem token válido com 401.
 * 
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {Function} next - Next handler function
 * @returns {Promise<void>}
 */
export async function requireAuth(req, res, next) {
  const stackAuthEnabled = isStackAuthEnabled()

  if (!stackAuthEnabled) {
    // Stack Auth não configurado - permitir acesso
    // Define um userId padrão para compatibilidade
    req.user = { id: 'default' }
    return next()
  }

  // Stack Auth configurado - validar JWT
  const stackUser = await getStackUser(req)
  const userId = sanitizeStackUserId(stackUser && stackUser.payload ? stackUser : null)

  if (!userId) {
    res.statusCode = 401
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      ok: false,
      error: 'Autenticação obrigatória. Forneça um token JWT válido via header Authorization: Bearer <token>',
      code: 'UNAUTHORIZED'
    }))
    return
  }

  // Anexar informações do usuário à requisição
  req.user = {
    id: userId,
    email: stackUser?.email || '',
    payload: stackUser?.payload || {}
  }

  next()
}

/**
 * Wrapper para aplicar o middleware requireAuth a um handler específico
 * 
 * @param {Function} handler - Handler function to wrap
 * @returns {Function} Wrapped handler function
 */
export function withAuth(handler) {
  return async (req, res) => {
    await requireAuth(req, res, async () => {
      await handler(req, res)
    })
  }
}
