import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import ProposalTemplate from '../src/pdf-html/ProposalTemplate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CSS_PATH = path.resolve(__dirname, '../src/pdf-html/proposal.css')
const LOGO_PATH = path.resolve(__dirname, '../public/proposal-header-logo.svg')

const buildHtml = async (payload) => {
  const [css, logoSvg] = await Promise.all([readFile(CSS_PATH, 'utf8'), readFile(LOGO_PATH, 'utf8')])
  const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString('base64')}`
  const markup = renderToStaticMarkup(
    React.createElement(ProposalTemplate, { data: { ...payload, logoUrl } }),
  )

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <style>${css}</style>
  </head>
  <body>
    ${markup}
  </body>
</html>`
}

export const generateProposalPdf = async (payload) => {
  const html = await buildHtml(payload)
  const executablePath = await chromium.executablePath()
  const browser = await playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: chromium.headless,
  })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      right: '16mm',
      bottom: '18mm',
      left: '16mm',
    },
  })
  await browser.close()
  return pdfBuffer
}
