import printBaseStyles from './print.css?raw'
import printColorStyles from './print-colors.css?raw'
import vendaStyles from '../components/print/styles/proposal-venda.css?raw'
import leasingStyles from '../components/print/styles/proposal-leasing.css?raw'

const previewScaffold = `
html[data-print-mode='preview'],
body[data-print-mode='preview'] {
  background: #f4f6fb;
  color: #0f172a;
}

body[data-print-mode='preview'] .print-page {
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
}
`

export const printStyles = `
${printBaseStyles}

${printColorStyles}

${vendaStyles}

${leasingStyles}

${previewScaffold}
`

export const simplePrintStyles = `
  [data-print-variant='simple'] *,[data-print-variant='simple'] *::before,[data-print-variant='simple'] *::after{box-sizing:border-box;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif!important;color:#000!important;text-shadow:none!important;}
  [data-print-variant='simple'] body{margin:0;padding:0;background:#fff!important;color:#000!important;font-size:12px;line-height:1.5;}
  [data-print-variant='simple'] h1,[data-print-variant='simple'] h2,[data-print-variant='simple'] h3{color:#000!important;font-weight:700;}
  [data-print-variant='simple'] .print-layout{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding:0 0 24px;}
  [data-print-variant='simple'] .print-layout>*{page-break-inside:avoid;break-inside:avoid;}
  [data-print-variant='simple'] .keep-with-next{break-after:avoid-page;page-break-after:avoid;}
  [data-print-variant='simple'] .no-break-inside{break-inside:avoid-page;page-break-inside:avoid;}
  [data-print-variant='simple'] .keep-together{break-inside:avoid-page;page-break-inside:avoid;}
  [data-print-variant='simple'] .page-break-before{break-before:page;page-break-before:always;}
  [data-print-variant='simple'] .page-break-after{break-after:page;page-break-after:always;}
  [data-print-variant='simple'] .print-hero{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:24px 28px;color:#000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .print-hero::after{display:none!important;}
  [data-print-variant='simple'] .print-hero__identity{gap:16px;}
  [data-print-variant='simple'] .print-logo{background:none!important;border:none!important;box-shadow:none!important;width:88px;height:88px;padding:0;}
  [data-print-variant='simple'] .print-logo img{max-width:72px;height:auto;filter:grayscale(100%) contrast(1.15);}
  [data-print-variant='simple'] .print-hero__eyebrow{font-size:11px;letter-spacing:0.18em;color:#000!important;}
  [data-print-variant='simple'] .print-hero__title h1{font-size:24px;}
  [data-print-variant='simple'] .print-hero__tagline{color:#000!important;font-size:12px;}
  [data-print-variant='simple'] .print-hero__summary{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:20px 24px;color:#000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .print-hero__summary h2{font-size:16px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-section{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:20px 24px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-section h2{margin:0 0 16px;font-size:18px;padding-bottom:0;border-bottom:1px solid #000;}
  [data-print-variant='simple'] .print-section h2::after{display:none!important;}
  [data-print-variant='simple'] .print-client-grid{gap:12px 18px;}
  [data-print-variant='simple'] .print-client-field dt{font-size:10px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-client-field dd{font-size:12px;}
  [data-print-variant='simple'] table{font-size:12px;border-collapse:collapse;}
  [data-print-variant='simple'] th,[data-print-variant='simple'] td{border:1px solid #000!important;padding:8px 10px;text-align:left;}
  [data-print-variant='simple'] thead{display:table-header-group;}
  [data-print-variant='simple'] tfoot{display:table-footer-group;}
  [data-print-variant='simple'] thead th{background:#f0f0f0!important;color:#000!important;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;}
  [data-print-variant='simple'] tbody tr:nth-child(even){background:#fff!important;}
  [data-print-variant='simple'] .print-key-values{gap:12px;}
  [data-print-variant='simple'] .print-key-values p{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;font-size:12px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-key-values strong{font-size:10px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-summary-grid{gap:16px;}
  [data-print-variant='simple'] .print-card{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:16px 18px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-card h3{font-size:14px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-subheading{margin:16px 0 6px;font-size:12px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-kpi-grid{gap:10px;}
  [data-print-variant='simple'] .print-kpi{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-kpi span{font-size:10px;letter-spacing:0.1em;}
  [data-print-variant='simple'] .print-kpi strong{font-size:16px;}
  [data-print-variant='simple'] .print-yearly-payments__item{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:14px 16px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-yearly-payments__header{align-items:center;}
  [data-print-variant='simple'] .print-yearly-payments__year{color:#000!important;font-size:18px;}
  [data-print-variant='simple'] .print-yearly-payments__year-label{color:#000!important;font-size:10px;}
  [data-print-variant='simple'] .print-yearly-payments__metrics dd{font-size:12px;}
  [data-print-variant='simple'] .print-chart{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:16px 18px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-chart::after{display:none!important;}
  [data-print-variant='simple'] .print-chart svg{filter:grayscale(100%) contrast(1.2)!important;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-grid line{stroke:#000!important;stroke-opacity:0.18;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-axis-line,[data-print-variant='simple'] .print-chart .recharts-cartesian-axis-tick-line{stroke:#000!important;}
  [data-print-variant='simple'] .print-chart .recharts-cartesian-axis-tick text,[data-print-variant='simple'] .print-chart .recharts-legend-item text{fill:#000!important;font-weight:600;}
  [data-print-variant='simple'] .print-chart-highlights{gap:10px;}
  [data-print-variant='simple'] .print-chart-highlights li{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:10px 12px;}
  [data-print-variant='simple'] .print-chart-highlights__year{font-size:11px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .print-chart-highlights__values{font-size:11px;}
  [data-print-variant='simple'] .chart-title{color:#000!important;font-size:16px;letter-spacing:0.12em;}
  [data-print-variant='simple'] .chart-explainer{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:12px 14px;color:#000!important;}
  [data-print-variant='simple'] .chart-explainer strong{color:#000!important;}
  [data-print-variant='simple'] .print-chart-footnote{color:#000!important;}
  [data-print-variant='simple'] ul{color:#000!important;font-size:12px;line-height:1.5;}
  [data-print-variant='simple'] .print-cta__box{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:18px 20px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-final-footer{background:#fff!important;border:1px solid #000!important;border-radius:4px;padding:18px 20px;box-shadow:none!important;}
  [data-print-variant='simple'] .print-final-footer__dates strong{color:#000!important;}
  [data-print-variant='simple'] .print-final-footer__signature span{font-size:11px;letter-spacing:0.12em;color:#000!important;}
  [data-print-variant='simple'] .signature-line{background:#000!important;height:1px;}
  [data-print-variant='simple'] .print-brand-footer{color:#000!important;letter-spacing:0.18em;}
  [data-print-variant='simple'] .print-brand-footer strong{color:#000!important;}
  [data-print-variant='simple'] .muted{color:#000!important;}
  [data-print-variant='simple'] img,[data-print-variant='simple'] svg,[data-print-variant='simple'] canvas{max-width:100%;height:auto;}
  [data-print-variant='simple'] .preview-toolbar{background:#fff!important;border-bottom:1px solid #000!important;box-shadow:none!important;}
  [data-print-variant='simple'] .preview-toolbar-info h1{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-info p{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-code strong{color:#000!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button{background:#0f172a;color:#fff;border:none;padding:8px 16px;font-size:13px;font-weight:600;border-radius:4px;}
  [data-print-variant='simple'] .preview-toolbar-actions button.secondary{background:#f4f4f4!important;color:#000!important;border:1px solid #000!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button.secondary:hover{background:#e5e5e5!important;}
  [data-print-variant='simple'] .preview-toolbar-actions button:hover{filter:none;}
  @media print{
    [data-print-variant='simple'] body{padding-top:0;}
    [data-print-variant='simple'] .preview-toolbar{display:none!important;}
  }
`;
