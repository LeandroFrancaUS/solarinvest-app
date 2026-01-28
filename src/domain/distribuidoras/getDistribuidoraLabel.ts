type DistribuidoraLabelInput = {
  uf?: string | null
  distribuidoraSelecionada?: string | null
}

export const getDistribuidoraLabel = (input: DistribuidoraLabelInput): string => {
  const selecionada = input.distribuidoraSelecionada?.trim()
  if (selecionada) {
    return selecionada
  }

  const uf = input.uf?.trim().toUpperCase() ?? ''

  switch (uf) {
    case 'DF':
      return 'Neoenergia Brasília'
    case 'GO':
      return 'Equatorial Goiás'
    case 'TO':
      return 'Equatorial Tocantins'
    default:
      return 'Concessionária local'
  }
}
