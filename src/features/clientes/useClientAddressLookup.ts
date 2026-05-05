import { useEffect, useRef, useState } from 'react'
import { lookupCep } from '../../shared/cepLookup'
import { normalizeNumbers } from '../../utils/formatters'
import { normalizeText } from '../../utils/textUtils'
import { getDistribuidoraDefaultForUf } from '../../utils/distribuidoraHelpers'
import type { ClienteDados } from '../../types/printableProposal'
import type { ClienteMensagens } from '../../types/cliente'
import type { LeasingEndereco, LeasingUcGeradoraTitular } from '../../store/useLeasingStore'

type IbgeMunicipio = {
  nome?: string
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string
      }
    }
  }
}

interface UseClientAddressLookupParams {
  cliente: ClienteDados
  clienteRef: React.RefObject<ClienteDados | null>
  isHydratingRef: React.RefObject<boolean>
  distribuidorasPorUf: Record<string, string[]>
  ensureIbgeMunicipios: (uf: string, signal?: AbortSignal) => Promise<string[]>
  updateClienteSync: (patch: Partial<ClienteDados>) => void
  setClienteMensagens: React.Dispatch<React.SetStateAction<ClienteMensagens>>
  setCidadeBloqueadaPorCep: (value: boolean) => void
  ucGeradoraTitularDraft: LeasingUcGeradoraTitular | null | undefined
  updateUcGeradoraTitularDraft: (patch: { endereco: Partial<LeasingEndereco> }) => void
}

interface UseClientAddressLookupResult {
  buscandoCep: boolean
  verificandoCidade: boolean
  ucGeradoraTitularBuscandoCep: boolean
  ucGeradoraTitularCepMessage: string | undefined
  ucGeradoraCidadeBloqueadaPorCep: boolean
  isApplyingCepRef: React.MutableRefObject<boolean>
  isEditingEnderecoRef: React.MutableRefObject<boolean>
  lastCepAppliedRef: React.MutableRefObject<string>
  isApplyingUcGeradoraCepRef: React.MutableRefObject<boolean>
  lastUcGeradoraCepAppliedRef: React.MutableRefObject<string>
  cepCidadeAvisoRef: React.MutableRefObject<string | null>
}

export function useClientAddressLookup({
  cliente,
  clienteRef,
  isHydratingRef,
  distribuidorasPorUf,
  ensureIbgeMunicipios,
  updateClienteSync,
  setClienteMensagens,
  setCidadeBloqueadaPorCep,
  ucGeradoraTitularDraft,
  updateUcGeradoraTitularDraft,
}: UseClientAddressLookupParams): UseClientAddressLookupResult {
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [verificandoCidade, setVerificandoCidade] = useState(false)
  const [ucGeradoraTitularBuscandoCep, setUcGeradoraTitularBuscandoCep] = useState(false)
  const [ucGeradoraTitularCepMessage, setUcGeradoraTitularCepMessage] = useState<
    string | undefined
  >(undefined)
  const [ucGeradoraCidadeBloqueadaPorCep, setUcGeradoraCidadeBloqueadaPorCep] = useState(false)

  const isApplyingCepRef = useRef(false)
  const isEditingEnderecoRef = useRef(false)
  const lastCepAppliedRef = useRef<string>('')
  const isApplyingUcGeradoraCepRef = useRef(false)
  const lastUcGeradoraCepAppliedRef = useRef<string>('')
  const cepCidadeAvisoRef = useRef<string | null>(null)

  // Effect 1: Cliente CEP → viaCEP lookup → auto-fills uf, cidade, distribuidora, endereco
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const cepNumeros = normalizeNumbers(clienteRef.current?.cep ?? cliente.cep)
    if (import.meta.env.DEV) {
      console.debug('[CEP effect] run', {
        cep: cepNumeros,
        hydrating: isHydratingRef.current,
        editingEndereco: isEditingEnderecoRef.current,
        last: lastCepAppliedRef.current,
      })
    }

    if (isHydratingRef.current || isApplyingCepRef.current || isEditingEnderecoRef.current) {
      return
    }

    if (cepNumeros.length !== 8) {
      setBuscandoCep(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))
      setCidadeBloqueadaPorCep(false)
      return
    }

    if (cepNumeros === lastCepAppliedRef.current) {
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setBuscandoCep(true)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cep: undefined }))

      try {
        isApplyingCepRef.current = true
        const data = await lookupCep(cepNumeros, controller.signal)
        if (!ativo) {
          return
        }

        if (!data) {
          setClienteMensagens((prev) => ({ ...prev, cep: 'CEP não encontrado.' }))
          setCidadeBloqueadaPorCep(false)
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.cidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''

        const base = clienteRef.current ?? cliente
        const enderecoAtual = base.endereco?.trim() ?? ''
        const patch: Partial<ClienteDados> = {}
        const cidadesDaUf = uf ? await ensureIbgeMunicipios(uf, controller.signal) : []
        const cidadeNormalizada = normalizeText(localidade)
        const cidadeEncontrada = cidadesDaUf.find(
          (cidade) => normalizeText(cidade) === cidadeNormalizada,
        )
        let avisoCidade: string | undefined

        if (uf && uf !== base.uf) {
          patch.uf = uf
        }

        if (localidade && uf) {
          if (cidadeEncontrada) {
            if (cidadeEncontrada !== base.cidade) {
              patch.cidade = cidadeEncontrada
            }
            setCidadeBloqueadaPorCep(true)
          } else {
            avisoCidade = 'Cidade do CEP não encontrada na base do IBGE. Informe manualmente.'
            setCidadeBloqueadaPorCep(false)
            if (localidade !== base.cidade) {
              patch.cidade = localidade
            }
          }
        } else {
          setCidadeBloqueadaPorCep(false)
        }

        if (uf && uf !== base.uf) {
          const listaDistribuidoras = distribuidorasPorUf[uf] ?? []
          let proximaDistribuidora = base.distribuidora
          if (listaDistribuidoras.length === 1) {
            proximaDistribuidora = listaDistribuidoras[0]!
          } else if (
            proximaDistribuidora &&
            !listaDistribuidoras.includes(proximaDistribuidora)
          ) {
            proximaDistribuidora = ''
          }
          if (!proximaDistribuidora) {
            const defaultDistribuidora = getDistribuidoraDefaultForUf(uf)
            if (defaultDistribuidora) {
              proximaDistribuidora = defaultDistribuidora
            }
          }
          if (proximaDistribuidora !== base.distribuidora) {
            patch.distribuidora = proximaDistribuidora
          }
        }
        if (!enderecoAtual && logradouro) {
          patch.endereco = logradouro
        }
        if (Object.keys(patch).length > 0) {
          updateClienteSync(patch)
        }

        lastCepAppliedRef.current = cepNumeros
        cepCidadeAvisoRef.current = avisoCidade ? base.cidade?.trim() ?? '' : null
        setClienteMensagens((prev): ClienteMensagens => ({
          ...prev,
          cep: undefined,
          cidade: avisoCidade,
        }))
      } catch (_error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cep: 'Não foi possível consultar o CEP.',
        }))
        setCidadeBloqueadaPorCep(false)
      } finally {
        if (ativo) {
          setBuscandoCep(false)
        }
        isApplyingCepRef.current = false
      }
    }

    const timeoutId = window.setTimeout(() => {
      void consultarCep()
    }, 500)

    return () => {
      ativo = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [cliente.cep, distribuidorasPorUf, ensureIbgeMunicipios])

  // Effect 2: ucGeradoraTitularDraft.cep → same enrichment pattern for UC Geradora Titular address
  useEffect(() => {
    const draft = ucGeradoraTitularDraft
    if (!draft) {
      setUcGeradoraTitularBuscandoCep(false)
      setUcGeradoraTitularCepMessage(undefined)
      return
    }

    const cepNumeros = normalizeNumbers(draft.endereco.cep ?? '')

    if (isHydratingRef.current || isApplyingUcGeradoraCepRef.current) {
      return
    }

    if (cepNumeros.length !== 8) {
      setUcGeradoraTitularBuscandoCep(false)
      setUcGeradoraTitularCepMessage(undefined)
      setUcGeradoraCidadeBloqueadaPorCep(false)
      return
    }

    if (cepNumeros === lastUcGeradoraCepAppliedRef.current) {
      return
    }

    let ativo = true
    const controller = new AbortController()

    const consultarCep = async () => {
      setUcGeradoraTitularBuscandoCep(true)
      setUcGeradoraTitularCepMessage(undefined)

      try {
        isApplyingUcGeradoraCepRef.current = true
        const data = await lookupCep(cepNumeros, controller.signal)
        if (!ativo) {
          return
        }

        if (!data) {
          setUcGeradoraTitularCepMessage('CEP não encontrado.')
          setUcGeradoraCidadeBloqueadaPorCep(false)
          return
        }

        const logradouro = data?.logradouro?.trim() ?? ''
        const localidade = data?.cidade?.trim() ?? ''
        const uf = data?.uf?.trim().toUpperCase() ?? ''
        const cidadesDaUf = uf ? await ensureIbgeMunicipios(uf, controller.signal) : []
        const cidadeNormalizada = normalizeText(localidade)
        const cidadeEncontrada = cidadesDaUf.find(
          (cidade) => normalizeText(cidade) === cidadeNormalizada,
        )
        let avisoCidade: string | undefined

        const patchEndereco: Partial<LeasingEndereco> = {}
        if (logradouro && !draft.endereco.logradouro.trim()) {
          patchEndereco.logradouro = logradouro
        }
        if (localidade) {
          if (cidadeEncontrada) {
            if (cidadeEncontrada !== draft.endereco.cidade) {
              patchEndereco.cidade = cidadeEncontrada
            }
            setUcGeradoraCidadeBloqueadaPorCep(true)
          } else {
            avisoCidade = 'Cidade do CEP não encontrada na base do IBGE. Informe manualmente.'
            setUcGeradoraCidadeBloqueadaPorCep(false)
            if (localidade !== draft.endereco.cidade) {
              patchEndereco.cidade = localidade
            }
          }
        } else {
          setUcGeradoraCidadeBloqueadaPorCep(false)
        }
        if (uf && uf !== draft.endereco.uf) {
          patchEndereco.uf = uf
        }
        if (Object.keys(patchEndereco).length > 0) {
          updateUcGeradoraTitularDraft({ endereco: patchEndereco })
        }

        lastUcGeradoraCepAppliedRef.current = cepNumeros
        setUcGeradoraTitularCepMessage(avisoCidade)
      } catch (_error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setUcGeradoraTitularCepMessage('Não foi possível consultar o CEP.')
        setUcGeradoraCidadeBloqueadaPorCep(false)
      } finally {
        if (ativo) {
          setUcGeradoraTitularBuscandoCep(false)
        }
        isApplyingUcGeradoraCepRef.current = false
      }
    }

    void consultarCep()

    return () => {
      ativo = false
      controller.abort()
    }
  }, [ensureIbgeMunicipios, ucGeradoraTitularDraft, updateUcGeradoraTitularDraft])

  // Effect 3: cliente.cidade → IBGE municipios API validation
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const nomeCidade = cliente.cidade.trim()
    const ufSelecionada = cliente.uf.trim().toUpperCase()

    if (cepCidadeAvisoRef.current !== null) {
      if (nomeCidade === cepCidadeAvisoRef.current) {
        setVerificandoCidade(false)
        return
      }
      cepCidadeAvisoRef.current = null
    }

    if (nomeCidade.length < 3) {
      setVerificandoCidade(false)
      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: undefined }))
      return
    }

    let ativo = true
    const controller = new AbortController()
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    const timeoutId = window.setTimeout(async () => {
      if (!ativo) {
        return
      }

      setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: undefined }))
      setVerificandoCidade(true)

      try {
        const response = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(nomeCidade)}`,
          { signal: controller.signal },
        )

        if (!response.ok) {
          throw new Error('Falha ao buscar municípios no IBGE.')
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data: IbgeMunicipio[] = await response.json()

        let aviso: string | undefined
        if (!Array.isArray(data) || data.length === 0) {
          aviso = 'Cidade não encontrada na base do IBGE.'
        } else {
          const cidadeNormalizada = normalizeText(nomeCidade)
          const possuiNome = data.some((municipio) => normalizeText(municipio?.nome ?? '') === cidadeNormalizada)

          if (!possuiNome) {
            aviso = 'Cidade não encontrada na base do IBGE.'
          } else if (ufSelecionada) {
            const existeNoEstado = data.some((municipio) => {
              if (normalizeText(municipio?.nome ?? '') !== cidadeNormalizada) {
                return false
              }

              const sigla = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? ''
              return sigla.toUpperCase() === ufSelecionada
            })

            if (!existeNoEstado) {
              aviso = `Cidade não encontrada no estado ${ufSelecionada}.`
            }
          }
        }

        setClienteMensagens((prev): ClienteMensagens => ({ ...prev, cidade: aviso }))
      } catch (_error) {
        if (!ativo || controller.signal.aborted) {
          return
        }

        setClienteMensagens((prev) => ({
          ...prev,
          cidade: 'Não foi possível verificar a cidade agora.',
        }))
      } finally {
        if (ativo) {
          setVerificandoCidade(false)
        }
      }
    }, 400)

    return () => {
      ativo = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [cliente.cidade, cliente.uf])

  return {
    buscandoCep,
    verificandoCidade,
    ucGeradoraTitularBuscandoCep,
    ucGeradoraTitularCepMessage,
    ucGeradoraCidadeBloqueadaPorCep,
    isApplyingCepRef,
    isEditingEnderecoRef,
    lastCepAppliedRef,
    isApplyingUcGeradoraCepRef,
    lastUcGeradoraCepAppliedRef,
    cepCidadeAvisoRef,
  }
}
