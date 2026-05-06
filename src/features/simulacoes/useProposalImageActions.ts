/**
 * useProposalImageActions.ts
 *
 * Owns the proposal-image upload/remove handlers extracted from App.tsx:
 *   - handleAbrirUploadImagens
 *   - handleImagensSelecionadas
 *   - handleRemoverPropostaImagem
 */

import { useCallback } from 'react'
import type React from 'react'
import type { PrintableProposalImage } from '../../types/printableProposal'

// ---------------------------------------------------------------------------
// Module-level pure helpers
// ---------------------------------------------------------------------------

const createPrintableImageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `imagem-${crypto.randomUUID()}`
  }

  const aleatorio = Math.floor(Math.random() * 1_000_000)
  return `imagem-${Date.now()}-${aleatorio.toString().padStart(6, '0')}`
}

const loadImageDimensions = (src: string): Promise<{ width: number | null; height: number | null }> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: null, height: null })
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      resolve({ width: null, height: null })
    }
    img.src = src
  })

const readPrintableImageFromFile = (file: File): Promise<PrintableProposalImage | null> => {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result
      if (typeof result !== 'string') {
        resolve(null)
        return
      }

      const dimensions = await loadImageDimensions(result)
      resolve({
        id: createPrintableImageId(),
        url: result,
        fileName: file.name || null,
        width: dimensions.width,
        height: dimensions.height,
      })
    }
    reader.onerror = () => resolve(null)
    reader.onabort = () => resolve(null)
    try {
      reader.readAsDataURL(file)
    } catch (_error) {
      resolve(null)
    }
  })
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseProposalImageActionsParams {
  imagensUploadInputRef: React.RefObject<HTMLInputElement | null>
  setPropostaImagens: React.Dispatch<React.SetStateAction<PrintableProposalImage[]>>
}

export function useProposalImageActions({
  imagensUploadInputRef,
  setPropostaImagens,
}: UseProposalImageActionsParams) {
  const handleAbrirUploadImagens = useCallback(() => {
    imagensUploadInputRef.current?.click()
  }, [imagensUploadInputRef])

  const handleImagensSelecionadas = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const arquivos = Array.from(event.target.files ?? [])
      if (!arquivos.length) {
        event.target.value = ''
        return
      }

      const imagens = await Promise.all(arquivos.map((arquivo) => readPrintableImageFromFile(arquivo)))
      const imagensValidas = imagens.filter(
        (imagem): imagem is PrintableProposalImage => Boolean(imagem && imagem.url),
      )
      if (imagensValidas.length > 0) {
        setPropostaImagens((prev) => [...prev, ...imagensValidas])
      }
      event.target.value = ''
    },
    [setPropostaImagens],
  )

  const handleRemoverPropostaImagem = useCallback(
    (imagemId: string, fallbackIndex: number) => {
      setPropostaImagens((prevImagens) => {
        if (prevImagens.length === 0) {
          return prevImagens
        }

        const filtradas = prevImagens.filter((imagem) => imagem.id !== imagemId)
        if (filtradas.length !== prevImagens.length) {
          return filtradas
        }

        if (fallbackIndex >= 0 && fallbackIndex < prevImagens.length) {
          return prevImagens.filter((_, index) => index !== fallbackIndex)
        }

        return prevImagens
      })
    },
    [setPropostaImagens],
  )

  return {
    handleAbrirUploadImagens,
    handleImagensSelecionadas,
    handleRemoverPropostaImagem,
  }
}
