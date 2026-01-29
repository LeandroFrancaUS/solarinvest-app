import fs from 'node:fs/promises'
import path from 'node:path'

import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import ProposalTemplate from '../src/pdf-html/ProposalTemplate.js'
import { createPrintableProposalFixture } from './fixtures/printableProposalFixture'

const OUTPUT_DIR = path.resolve('artifacts', 'printable-visual-check')
const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const BLANK_ROW_THRESHOLD = 0.98
const MAX_BLANK_RUN_RATIO = 0.35

const readCss = async (filePath: string) => {
  const content = await fs.readFile(filePath, 'utf8')
  return content.replace(/@import[^;]+;/g, '')
}

const buildHtml = async () => {
  const styles = await readCss(path.resolve('src/pdf-html/proposal.css'))
  const logoSvg = await readCss(path.resolve('public/proposal-header-logo.svg'))
  const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`
  const markup = renderToStaticMarkup(
    React.createElement(ProposalTemplate, {
      data: { ...createPrintableProposalFixture(), logoUrl },
    }),
  )

  return `<!doctype html>
<html lang="pt-BR" data-print-mode="print">
  <head>
    <meta charset="utf-8" />
    <style>${styles}</style>
  </head>
  <body>
    ${markup}
  </body>
</html>`
}

const analyzeScreenshot = async (filePath: string) => {
  const buffer = await fs.readFile(filePath)
  const png = PNG.sync.read(buffer)
  const { width, height, data } = png
  let whitePixelCount = 0
  let longestBlankRun = 0
  let currentRun = 0

  for (let y = 0; y < height; y += 1) {
    let whitePixelsInRow = 0
    for (let x = 0; x < width; x += 1) {
      const idx = (width * y + x) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const isWhite = r >= 245 && g >= 245 && b >= 245
      if (isWhite) {
        whitePixelsInRow += 1
        whitePixelCount += 1
      }
    }

    const rowBlankRatio = whitePixelsInRow / width
    if (rowBlankRatio >= BLANK_ROW_THRESHOLD) {
      currentRun += 1
      longestBlankRun = Math.max(longestBlankRun, currentRun)
    } else {
      currentRun = 0
    }
  }

  return {
    blankRatio: whitePixelCount / (width * height),
    longestBlankRunRatio: longestBlankRun / height,
  }
}

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const html = await buildHtml()

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT } })
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })

  const pdfPath = path.join(OUTPUT_DIR, 'proposal.pdf')
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true })

  const emptySections = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.section'))
    return sections
      .map((section) => {
        const heading = section.querySelector('h1, h2, h3, h4')
        if (!heading) {
          return null
        }
        const contentNodes = Array.from(section.children).filter((child) => child !== heading)
        const contentText = contentNodes.map((node) => node.textContent ?? '').join('').replace(/\s+/g, '')
        return contentText.length === 0 ? heading.textContent?.trim() ?? 'Seção sem título' : null
      })
      .filter((value): value is string => Boolean(value))
  })

  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  const pageCount = Math.max(1, Math.ceil(totalHeight / PAGE_HEIGHT))

  const blankResults: Array<{ page: number; blankRatio: number; longestBlankRunRatio: number }> = []
  for (let index = 0; index < pageCount; index += 1) {
    const screenshotPath = path.join(OUTPUT_DIR, `page-${index + 1}.png`)
    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: 0,
        y: index * PAGE_HEIGHT,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      },
    })

    const result = await analyzeScreenshot(screenshotPath)
    blankResults.push({ page: index + 1, ...result })
  }

  await browser.close()

  const failures: string[] = []
  if (emptySections.length > 0) {
    failures.push(`Seções sem conteúdo detectadas: ${emptySections.join(', ')}`)
  }

  blankResults.forEach((result, index) => {
    if (index === 0) {
      return
    }
    if (result.longestBlankRunRatio > MAX_BLANK_RUN_RATIO) {
      failures.push(
        `Página ${result.page} com faixa vazia de ${(result.longestBlankRunRatio * 100).toFixed(1)}%`,
      )
    }
  })

  if (failures.length > 0) {
    const summaryPath = path.join(OUTPUT_DIR, 'summary.json')
    await fs.writeFile(summaryPath, JSON.stringify({ failures, blankResults }, null, 2))
    console.error('Falha no teste visual do PDF:', failures.join(' | '))
    process.exit(1)
  }

  console.log('Teste visual do PDF concluído com sucesso.')
}

main().catch((error) => {
  console.error('Erro ao executar teste visual do PDF:', error)
  process.exit(1)
})
