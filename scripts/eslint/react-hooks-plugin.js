const HOOK_WITH_DEPS = new Set(['useEffect', 'useMemo', 'useCallback', 'useLayoutEffect'])

const isHookName = (name) => /^use[A-Z0-9].*/.test(name)

const isComponentOrHook = (fnNode) => {
  if (!fnNode) return false
  if (fnNode.type === 'FunctionDeclaration') {
    const identifier = fnNode.id?.name
    if (!identifier) return false
    return identifier[0] === identifier[0]?.toUpperCase() || isHookName(identifier)
  }
  if (fnNode.type === 'FunctionExpression' || fnNode.type === 'ArrowFunctionExpression') {
    const parent = fnNode.parent
    if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
      const name = parent.id.name
      return name[0] === name[0]?.toUpperCase() || isHookName(name)
    }
    if (parent?.type === 'Property' && parent.key.type === 'Identifier') {
      const name = parent.key.name
      return name[0] === name[0]?.toUpperCase() || isHookName(name)
    }
  }
  return false
}

const createRulesOfHooks = (context) => ({
  CallExpression(node) {
    if (node.callee.type !== 'Identifier') return
    const { name } = node.callee
    if (!isHookName(name)) return

    const ancestors = context.getAncestors()
    for (const ancestor of ancestors) {
      if (
        ancestor.type === 'IfStatement' ||
        ancestor.type === 'ForStatement' ||
        ancestor.type === 'WhileStatement' ||
        ancestor.type === 'DoWhileStatement' ||
        ancestor.type === 'SwitchStatement'
      ) {
        context.report({ node, message: 'Hooks devem ser chamados incondicionalmente no topo do componente.' })
        return
      }
    }

    const functionAncestor = [...ancestors].reverse().find((ancestor) =>
      ancestor.type === 'FunctionDeclaration' ||
      ancestor.type === 'FunctionExpression' ||
      ancestor.type === 'ArrowFunctionExpression',
    )

    if (!isComponentOrHook(functionAncestor)) {
      context.report({ node, message: 'Hooks devem ser chamados dentro de componentes React ou hooks.' })
    }
  },
})

const createExhaustiveDeps = (context) => ({
  CallExpression(node) {
    if (node.callee.type !== 'Identifier') return
    const { name } = node.callee
    if (!HOOK_WITH_DEPS.has(name)) return

    if (node.arguments.length < 2) {
      context.report({ node, message: `O hook ${name} deve receber um array de dependências.` })
      return
    }
    const depsArg = node.arguments[1]
    if (depsArg.type !== 'ArrayExpression') {
      context.report({ node: depsArg, message: 'O array de dependências deve ser um literal de array.' })
    }
  },
})

export default {
  meta: {
    name: 'custom-react-hooks-plugin',
  },
  rules: {
    'rules-of-hooks': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Garante que hooks sejam chamados em posições válidas.',
        },
      },
      create: createRulesOfHooks,
    },
    'exhaustive-deps': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Garante que hooks com dependências recebam um array válido.',
        },
      },
      create: createExhaustiveDeps,
    },
  },
}
