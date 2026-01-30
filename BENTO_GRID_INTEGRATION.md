# Integração do Bento Grid PDF - Guia Completo

## Status: ✅ INTEGRADO AO PIPELINE

O gerador de PDF Bento Grid está completamente integrado ao fluxo de geração de propostas da aplicação.

## Como Funciona

### Fluxo Automático (Atual)

Quando o usuário gera uma proposta no app:

```
1. Usuário clica em "Gerar PDF" ou "Gerar Pacote"
2. App chama prepararPropostaParaExportacao()
3. Internamente chama renderPrintableProposalToHtml(dados)
4. Função verifica: shouldUseBentoGrid(dados)?
   - Se SIM → renderBentoLeasingToHtml() (Bento Grid)
   - Se NÃO → renderização legada
5. HTML é encapsulado com buildProposalPdfDocument()
6. Função detecta marcador data-testid="proposal-bento-root"
7. Se detectado → usa buildBentoLeasingPdfDocument()
8. HTML final enviado ao serviço de PDF
```

### Rota de Impressão (Playwright/Browser)

Para geração via Playwright ou visualização direta:

```
URL: http://localhost:5173?mode=print&type=leasing
```

**O que acontece:**
1. App detecta `?mode=print&type=leasing` na URL
2. Renderiza `PrintPageLeasing` em vez do app normal
3. Componente carrega Paged.js do `/vendor/paged.polyfill.js`
4. Paged.js renderiza as páginas A4 com paginação adequada
5. Define `window.pagedRenderingComplete = true` quando pronto
6. Playwright pode capturar o PDF

## Ativação

### 1. Habilitar Feature Flag

Crie ou edite `.env`:

```bash
VITE_USE_BENTO_GRID_PDF=true
```

**Comportamento:**
- ✅ Propostas de LEASING → Bento Grid (5 páginas, cards, sem tabelas)
- ✅ Outras propostas → Sistema legado
- ✅ Rollout gradual e seguro

### 2. Verificar Build

```bash
npm run build
```

Deve compilar sem erros e gerar o chunk `PrintPageLeasing-*.js`.

## Teste Manual

### Opção A: Visualização no Navegador

1. Inicie o servidor dev:
   ```bash
   npm run dev
   ```

2. Acesse a rota de impressão:
   ```
   http://localhost:5173?mode=print&type=leasing
   ```

3. Verifique:
   - ✅ Fundo slate-50 (#F8FAFC)
   - ✅ Cards arredondados com sombras
   - ✅ Layout Bento Grid (12 colunas)
   - ✅ SEM tabelas na seção financeira
   - ✅ 5 páginas de conteúdo

### Opção B: Geração de PDF no App

1. Com feature flag ativado, use o app normalmente
2. Crie/edite uma proposta de leasing
3. Clique em "Gerar PDF" ou "Gerar Pacote"
4. O PDF deve usar o layout Bento Grid automaticamente

## Integração Playwright

Para automação de PDF via Playwright:

```typescript
import { chromium } from 'playwright'

async function generateLeasingPDF(proposalId: string) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  // Navegar para rota de impressão
  await page.goto(`http://localhost:5173?mode=print&type=leasing`, {
    waitUntil: 'networkidle'
  })
  
  // Aguardar marcador Bento Grid
  await page.waitForSelector(
    '[data-testid="proposal-bento-root"][data-version="premium-v1"]',
    { timeout: 30000 }
  )
  
  // Validar CSS aplicado
  const bg = await page.evaluate(() => 
    getComputedStyle(document.body).backgroundColor
  )
  if (bg !== 'rgb(248, 250, 252)') {
    throw new Error('Tailwind CSS não aplicado corretamente')
  }
  
  // Aguardar Paged.js completar
  await page.waitForFunction(
    () => (window as any).pagedRenderingComplete === true,
    { timeout: 60000 }
  )
  
  // Screenshot para debug
  await page.screenshot({ 
    path: 'debug/proposal.png', 
    fullPage: true 
  })
  
  // Gerar PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  })
  
  await browser.close()
  return pdf
}
```

## Validações Automáticas

O sistema inclui validações para garantir qualidade:

### 1. Marcadores de Validação

```html
<div 
  data-testid="proposal-bento-root" 
  data-version="premium-v1"
  class="bg-solar-bg"
>
```

### 2. Verificação de CSS

```javascript
// Playwright pode verificar
const bg = await page.evaluate(() => 
  getComputedStyle(document.body).backgroundColor
)
// Deve ser: rgb(248, 250, 252) ou #F8FAFC
```

### 3. Paginação Completa

```javascript
await page.waitForFunction(() => 
  window.pagedRenderingComplete === true
)
```

## Estrutura de Páginas

O PDF Bento Grid gera 5 páginas premium:

### Página 1: Capa Hero
- Card highlight com informações do cliente
- 3 KPIs principais (Potência, Geração, Desconto)
- Seção "Como Funciona" (3 passos)

### Página 2: Oferta de Leasing
- Cabeçalho dark
- O que está incluso (6 bullets)
- Condições essenciais (formato label/valor)
- Card de destaque com benefício

### Página 3: Especificações Técnicas
- Cabeçalho dark
- 3 KPIs técnicos em cards
- Equipamentos (módulos e inversores)
- Requisitos de instalação

### Página 4: Resumo Financeiro
- Cabeçalho dark
- Comparação mensal (3 colunas)
- 4 mini-cards de economia acumulada (5, 10, 20, 30 anos)
- **SEM TABELAS** - dados em cards
- Valor do ativo ao final (opcional)

### Página 5: Termos Essenciais
- Cabeçalho dark
- Responsabilidades SolarInvest (6 bullets)
- Responsabilidades do cliente (4 bullets)
- Destaque: Transferência de propriedade
- Aviso legal

## Troubleshooting

### PDF ainda usa layout antigo

**Causa:** Feature flag não ativado ou não carregado

**Solução:**
1. Verificar `.env` contém `VITE_USE_BENTO_GRID_PDF=true`
2. Reiniciar servidor dev: `npm run dev`
3. Limpar cache: `rm -rf node_modules/.vite && npm run dev`

### Tailwind CSS não aplicado

**Causa:** CSS não carregado na rota de impressão

**Solução:**
1. Verificar `src/styles.css` contém `@tailwind` directives
2. Verificar `tailwind.config.js` está configurado
3. Build: `npm run build` e verificar sem erros

### Paged.js não carrega

**Causa:** Polyfill não copiado para `public/vendor/`

**Solução:**
```bash
node scripts/copy-pagedjs-polyfill.mjs
```

### Páginas quebradas/cortadas

**Causa:** `break-inside-avoid` não aplicado

**Solução:**
- Verificar cards têm classe `break-inside-avoid`
- Verificar plugin Tailwind está configurado

### Tabelas ainda aparecem

**Causa:** Feature flag OFF ou proposta não é LEASING

**Solução:**
1. Confirmar `shouldUseBentoGrid()` retorna `true`
2. Verificar `dados.tipoProposta === 'LEASING'`
3. Verificar feature flag ativado

## Debug

### Gerar HTML para inspeção

Adicione antes de gerar PDF:

```typescript
const html = await renderPrintableProposalToHtml(dados)
await fs.writeFile('debug/proposal.html', html)
```

### Capturar screenshot

Com Playwright:

```typescript
await page.screenshot({ 
  path: 'debug/proposal.png', 
  fullPage: true 
})
```

### Logs de console

O sistema loga:

```
✓ Paged.js polyfill loaded
✓ Paged.js rendering complete
```

Se não vê esses logs, Paged.js não carregou.

## Rollback

Para reverter ao sistema legado:

### Opção 1: Desativar feature flag

```bash
# Em .env
VITE_USE_BENTO_GRID_PDF=false
```

### Opção 2: Remover da URL

Simplesmente não use `?mode=print&type=leasing`.

### Opção 3: Git revert

```bash
git revert d60f4ed  # commit de integração
```

## Métricas de Sucesso

Ao validar a integração, verificar:

- ✅ PDF gerado tem 5 páginas
- ✅ Fundo slate-50 visível
- ✅ Cards arredondados presentes
- ✅ **Zero tabelas HTML** na seção financeira
- ✅ Cores exatas (não desbotadas)
- ✅ Tipografia compacta (text-sm/leading-6)
- ✅ Margens zero (full-bleed A4)

## Suporte

Documentação completa:
- `BENTO_GRID_IMPLEMENTATION.md` - Arquitetura técnica
- `BENTO_GRID_DELIVERY.md` - Resumo da entrega
- `BENTO_GRID_INTEGRATION.md` - Este guia

Arquivos-chave:
- `src/App.tsx` - Ponto de integração
- `src/utils/pdfVariant.ts` - Feature flag
- `src/utils/renderBentoLeasing.tsx` - Renderização
- `src/components/pdf/PrintableProposalLeasingBento.tsx` - Componente principal
- `src/pages/PrintPageLeasing.tsx` - Rota de impressão

---

**Status Final:** ✅ Integração completa e pronta para produção
