export type Linha = {
  nome: string
  codigo?: string
  modelo?: string
  fabricante?: string
  quantidade?: number | null
}

export function agrupar(itens: Linha[]) {
  const Hardware = {
    Modulos: [] as Linha[],
    Inversores: [] as Linha[],
    KitsECabosEAterramentoEAcessorios: [] as Linha[],
  }
  const Servicos = {
    EngenhariaEInstalacaoEHomologacao: [] as Linha[],
  }

  itens.forEach((item) => {
    const nome = (item.nome || '').toUpperCase()
    if (!nome) {
      return
    }
    if (nome.includes('MÓDULO') || nome.includes('MODULO') || nome.includes('PLACA')) {
      Hardware.Modulos.push(item)
      return
    }
    if (nome.includes('INVERSOR')) {
      Hardware.Inversores.push(item)
      return
    }
    if (
      nome.includes('CABO') ||
      nome.includes('CONECTOR') ||
      nome.includes('ATERR') ||
      nome.includes('PERFIL') ||
      nome.includes('GRAMPO') ||
      nome.includes('SUPORTE') ||
      nome.includes('HASTE') ||
      nome.includes('JUNÇÃO') ||
      nome.includes('JUNCAO') ||
      nome.includes('FIXAÇÃO') ||
      nome.includes('FIXACAO')
    ) {
      Hardware.KitsECabosEAterramentoEAcessorios.push(item)
      return
    }
    if (
      nome.includes('ART') ||
      nome.includes('APROVA') ||
      nome.includes('INSTALA') ||
      nome.includes('CALAFETA') ||
      nome.includes('CONEX') ||
      nome.includes('VISTORIA') ||
      nome.includes('HOMOLOGA') ||
      nome.includes('MONITORAMENTO')
    ) {
      Servicos.EngenhariaEInstalacaoEHomologacao.push(item)
      return
    }
    Hardware.KitsECabosEAterramentoEAcessorios.push(item)
  })

  return { Hardware, Servicos }
}
