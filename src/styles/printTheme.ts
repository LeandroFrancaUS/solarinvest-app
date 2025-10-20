export const printStyles = `
  *,*::before,*::after{box-sizing:border-box;font-family:'Montserrat','Roboto',sans-serif;}
  body{margin:0;padding:0;background:#f4f6fb;color:#0c162c;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}
  h1,h2,h3{color:#0c162c;font-weight:700;}
  .print-layout{max-width:calc(210mm - 32mm);width:100%;margin:0 auto;display:flex;flex-direction:column;gap:28px;page-break-after:avoid;}
  .keep-with-next{break-after:avoid-page;page-break-after:avoid;}
  .no-break-inside{break-inside:avoid-page;page-break-inside:avoid;}
  .keep-together{break-inside:avoid-page;page-break-inside:avoid;}
  .page-break-before{break-before:page;page-break-before:always;}
  .page-break-after{break-after:page;page-break-after:always;}
  .print-layout>*{break-inside:avoid;page-break-inside:avoid;}
  .print-hero{position:relative;display:flex;flex-direction:column;gap:24px;padding:40px 44px;border-radius:40px;background:radial-gradient(140% 160% at 0% 0%,rgba(255,255,255,0.18) 0%,rgba(12,22,44,0) 70%),linear-gradient(135deg,#0c162c 0%,#13294c 58%,#1f3a6f 100%);color:#f8fafc;box-shadow:0 26px 60px rgba(12,22,44,0.36);overflow:hidden;}
  .print-hero,.print-section,.print-card,.print-chart,.print-cta__box{color-adjust:exact;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .print-hero,.print-hero__summary,.print-section,.print-card,.print-yearly-payments__item,.print-final-footer,.print-cta__box{break-inside:avoid;page-break-inside:avoid;}
  .print-hero::after{content:'';position:absolute;inset:auto -160px -200px auto;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at center,rgba(255,255,255,0.25),transparent 72%);opacity:0.9;}
  .print-hero__header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:32px;position:relative;z-index:1;}
  .print-hero__identity{display:flex;align-items:center;gap:28px;min-width:280px;}
  .print-logo{width:110px;height:110px;border-radius:32px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(12,22,44,0.32);backdrop-filter:blur(6px);}
  .print-logo img{width:72px;height:auto;display:block;}
  .print-hero__title{display:flex;flex-direction:column;gap:8px;}
  .print-hero__eyebrow{font-size:12px;letter-spacing:0.28em;text-transform:uppercase;font-weight:600;color:rgba(248,250,252,0.74);}
  .print-hero__title h1{margin:0;font-size:34px;line-height:1.1;color:inherit;text-shadow:0 10px 36px rgba(12,22,44,0.45);}
  .print-hero__tagline{margin:0;font-size:15px;max-width:320px;color:rgba(248,250,252,0.9);}
  .print-hero__summary{position:relative;z-index:1;padding:28px 30px;border-radius:28px;background:rgba(12,22,44,0.7);backdrop-filter:blur(6px);font-size:14px;line-height:1.6;color:rgba(248,250,252,0.94);border:1px solid rgba(255,255,255,0.12);}
  .print-hero__summary h2{margin:0 0 12px;font-size:18px;color:#f8fafc;text-transform:uppercase;letter-spacing:0.18em;}
  .print-section{background:#ffffff;border-radius:28px;padding:30px 34px;box-shadow:0 20px 44px rgba(12,22,44,0.12);border:1px solid rgba(12,22,44,0.08);page-break-inside:avoid;break-inside:avoid;}
  .print-section h2{margin:0 0 18px;font-size:22px;letter-spacing:-0.01em;color:#0c162c;position:relative;padding-bottom:8px;}
  .print-section h2::after{content:'';position:absolute;left:0;bottom:0;width:56px;height:3px;border-radius:999px;background:linear-gradient(135deg,#ff8c00,#f97316);}
  .print-client-grid{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px 28px;}
  .print-client-field{display:flex;flex-direction:column;gap:6px;}
  .print-client-field dt{margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;color:rgba(12,22,44,0.62);}
  .print-client-field dd{margin:0;font-size:13px;color:inherit;font-weight:600;line-height:1.35;}
  .print-client-field--wide{grid-column:span 2;}
  .print-kit-grid{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px 28px;}
  .print-kit-field{display:flex;flex-direction:column;gap:6px;}
  .print-kit-field dt{margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:600;color:rgba(12,22,44,0.62);}
  .print-kit-field dd{margin:0;font-size:13px;color:inherit;font-weight:600;line-height:1.35;}
  table{width:100%;border-collapse:collapse;font-size:13px;page-break-inside:avoid;break-inside:avoid;}
  thead{display:table-header-group;}
  tfoot{display:table-footer-group;}
  th,td{border:1px solid rgba(12,22,44,0.12);padding:10px 14px;text-align:left;page-break-inside:avoid;break-inside:avoid;}
  thead,tbody,tr{page-break-inside:avoid;break-inside:avoid;}
  thead th{background:#0c162c;color:#f8fafc;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:0.14em;}
  tbody tr:nth-child(even){background:#f8fafc;}
  .print-key-values{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-bottom:24px;}
  .print-key-values p{margin:0;padding:18px 20px;border-radius:22px;background:rgba(12,22,44,0.03);border:1px solid rgba(12,22,44,0.1);font-size:13px;line-height:1.45;box-shadow:0 12px 26px rgba(12,22,44,0.08);}
  .print-key-values strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#0c162c;margin-bottom:6px;}
  .print-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;break-inside:auto;page-break-inside:auto;}
  .print-summary-grid>*{break-inside:avoid;page-break-inside:avoid;}
  .print-yearly-payments{display:grid;gap:16px;break-inside:auto;page-break-inside:auto;}
  .print-card{border:1px solid rgba(12,22,44,0.1);border-radius:26px;padding:26px 28px;background:linear-gradient(135deg,#f8fafc 0%,#e9eef6 100%);box-shadow:0 18px 40px rgba(12,22,44,0.14);}
  .print-card h3{margin:0 0 16px;font-size:16px;color:#0c162c;text-transform:uppercase;letter-spacing:0.14em;}
  .print-card .muted{margin:12px 0 0;}
  .print-subheading{margin:26px 0 12px;font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#0c162c;}
  .print-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:0 0 18px;}
  .print-kpi{padding:18px 20px;border-radius:20px;background:rgba(12,22,44,0.05);border:1px solid rgba(12,22,44,0.12);box-shadow:0 10px 24px rgba(12,22,44,0.12);}
  .print-kpi span{display:block;margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(12,22,44,0.66);}
  .print-kpi strong{display:block;font-size:20px;color:#0c162c;}
  .print-metric-list p{margin:0 0 10px;font-size:13px;}
  .print-chart-section{display:flex;flex-direction:column;gap:18px;}
  .print-chart{position:relative;padding:24px 28px;border-radius:28px;border:1px solid rgba(15,23,42,0.16);background:linear-gradient(155deg,rgba(255,255,255,0.98) 0%,rgba(226,232,240,0.9) 48%,rgba(248,250,252,0.95) 100%);box-shadow:0 22px 48px rgba(15,23,42,0.18);}
  .print-chart::after{content:'';position:absolute;inset:14px 14px auto auto;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at center,rgba(255,140,0,0.22),transparent 72%);opacity:0.85;}
  .print-chart .recharts-responsive-container{width:100%!important;height:320px!important;margin:0 auto;}
  .print-chart svg{overflow:visible;}
  .print-chart .recharts-cartesian-axis-line,.print-chart .recharts-cartesian-axis-tick-line{stroke:rgba(15,23,42,0.28);}
  .print-chart .recharts-cartesian-axis-tick text{fill:#0f172a;font-size:12px;font-weight:600;}
  .print-chart .recharts-legend-wrapper{padding-top:0!important;}
  .print-chart .recharts-legend-item text{fill:#0f172a;font-weight:700;font-size:12px;letter-spacing:0.02em;}
  .print-chart .recharts-cartesian-grid line{stroke:#cbd5f5;}
  .print-chart .recharts-tooltip-wrapper{display:none!important;}
  .print-chart-highlights{margin:18px 0 0;padding:0;list-style:none;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));}
  .print-chart-highlights li{background:rgba(255,255,255,0.85);border:1px solid rgba(148,163,184,0.38);border-radius:18px;padding:12px 16px;display:flex;flex-direction:column;gap:6px;}
  .print-chart-highlights__year{font-size:12px;font-weight:700;color:#0f172a;letter-spacing:0.08em;text-transform:uppercase;}
  .print-chart-highlights__values{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;line-height:1.3;}
  .print-chart-highlights__value{display:inline-flex;align-items:center;gap:4px;}
  .chart{max-width:100%;height:auto;display:block;}
  .chart-title{margin:0;font-size:18px;color:#0c162c;text-transform:uppercase;letter-spacing:0.18em;}
  .chart-explainer{margin:18px 0 0;background:rgba(15,23,42,0.06);padding:14px 18px;border-radius:20px;border:1px solid rgba(15,23,42,0.18);font-size:13px;color:#0f172a;line-height:1.55;}
  .chart-explainer strong{font-size:14px;color:#0c162c;}
  .print-chart-footnote{margin:10px 0 0;font-size:12px;color:#475569;}
  ul{margin:0;padding-left:20px;font-size:13px;color:#1f2937;line-height:1.55;}
  ul li{margin-bottom:8px;}
  .print-cta{padding:0;border:none;background:none;box-shadow:none;}
  .print-cta__box{border-radius:30px;background:linear-gradient(135deg,#e2e8f0 0%,#cbd5f5 100%);padding:32px 36px;display:flex;flex-direction:column;gap:12px;align-items:flex-start;border:1px solid rgba(12,22,44,0.12);box-shadow:0 18px 42px rgba(12,22,44,0.18);}
  .print-cta__box h2{margin:0;font-size:24px;color:#0c162c;letter-spacing:0.08em;text-transform:uppercase;}
  .print-cta__box p{margin:0;font-size:15px;color:#1e293b;}
  .print-final-footer{display:flex;flex-wrap:wrap;gap:28px;justify-content:space-between;align-items:flex-start;background:#ffffff;border-radius:28px;padding:30px 34px;box-shadow:0 22px 46px rgba(12,22,44,0.14);page-break-inside:avoid;}
  .print-final-footer__dates{display:flex;flex-direction:column;gap:10px;font-size:13px;color:#1f2937;}
  .print-final-footer__dates strong{color:#0c162c;}
  .print-final-footer__signature{display:flex;flex-direction:column;align-items:center;gap:10px;min-width:240px;}
  .signature-line{width:100%;height:1px;background:#cbd5f5;margin-top:28px;}
  .print-final-footer__signature span{font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#475569;}
  .print-brand-footer{display:flex;justify-content:center;align-items:center;gap:10px;font-size:12px;color:#0c162c;text-transform:uppercase;letter-spacing:0.24em;padding-bottom:18px;}
  .print-brand-footer strong{color:#ff8c00;}
  img,svg,canvas{max-width:100%;height:auto;}
  .muted{text-align:center;color:#64748b;font-size:12px;padding:20px 12px;}
  .print-yearly-payments{display:grid;gap:16px;break-inside:auto;page-break-inside:auto;}
  .print-yearly-payments__item{display:flex;flex-direction:column;gap:12px;padding:20px 22px;border-radius:22px;background:rgba(12,22,44,0.04);border:1px solid rgba(12,22,44,0.12);box-shadow:0 12px 26px rgba(12,22,44,0.12);}
  .print-yearly-payments__header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;}
  .print-yearly-payments__year-label{font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(12,22,44,0.6);}
  .print-yearly-payments__year{font-size:22px;font-weight:700;color:#ff8c00;text-transform:uppercase;}
  .print-yearly-payments__metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px 18px;margin:4px 0 0;}
  .print-yearly-payments__metrics div{display:flex;flex-direction:column;gap:4px;}
  .print-yearly-payments__metrics dt{margin:0;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(12,22,44,0.55);}
  .print-yearly-payments__metrics dd{margin:0;font-size:14px;font-weight:600;color:#0c162c;}
  .print-yearly-payments__empty{margin:0;font-size:13px;color:#475569;}
  html[data-print-mode='print'],body[data-print-mode='print']{background:#ffffff;color:#0f172a;}
  html[data-print-mode='print'] .print-layout{background:none;}
  html[data-print-mode='print'] .print-hero{background:#ffffff;color:#0f172a;box-shadow:none;border:1px solid rgba(15,23,42,0.22);}
  html[data-print-mode='print'] .print-hero::after{display:none;}
  html[data-print-mode='print'] .print-logo{background:#f1f5f9;border:1px solid rgba(15,23,42,0.12);box-shadow:none;}
  html[data-print-mode='print'] .print-logo img{filter:grayscale(100%);opacity:0.85;}
  html[data-print-mode='print'] .print-hero__eyebrow{color:#1f2937;}
  html[data-print-mode='print'] .print-hero__title h1{text-shadow:none;color:#0f172a;}
  html[data-print-mode='print'] .print-hero__tagline{color:#1f2937;}
  html[data-print-mode='print'] .print-hero__summary{background:#ffffff;color:#0f172a;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-hero__summary h2{color:#0f172a;}
  html[data-print-mode='print'] .print-section{background:#ffffff;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-section h2{color:#0f172a;}
  html[data-print-mode='print'] .print-section h2::after{background:#0f172a;}
  html[data-print-mode='print'] .print-key-values p{background:#ffffff;border:1px solid rgba(15,23,42,0.16);box-shadow:none;}
  html[data-print-mode='print'] .print-card{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-card h3{color:#0f172a;}
  html[data-print-mode='print'] .print-cta__box{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-final-footer{background:#ffffff;border:1px solid rgba(15,23,42,0.2);box-shadow:none;}
  html[data-print-mode='print'] .print-final-footer__dates strong{color:#0f172a;}
  html[data-print-mode='print'] .print-brand-footer{color:#0f172a;}
  html[data-print-mode='print'] .print-brand-footer strong{color:#0f172a;}
  html[data-print-mode='print'] .print-yearly-payments__item{background:#ffffff;border:1px solid rgba(15,23,42,0.18);box-shadow:none;}
  html[data-print-mode='print'] .print-yearly-payments__year{color:#0f172a;}
  html[data-print-mode='print'] .print-yearly-payments__year-label{color:#0f172a;}
  html[data-print-mode='print'] .print-chart{background:#ffffff;border:1px solid rgba(15,23,42,0.24);box-shadow:none;}
  html[data-print-mode='print'] .print-chart::after{display:none;}
  html[data-print-mode='download'] .print-chart::after{display:none;}
  html[data-print-mode='print'] .print-chart .recharts-legend-item text{fill:#0f172a;}
  html[data-print-mode='print'] .chart-title{color:#0f172a;}
  html[data-print-mode='print'] .chart-explainer{background:#ffffff;border:1px solid rgba(15,23,42,0.24);color:#0f172a;}
  html[data-print-mode='print'] .chart-explainer strong{color:#0f172a;}
  html[data-print-mode='print'] .print-chart-highlights li{background:#ffffff;border:1px solid rgba(15,23,42,0.26);}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-line,
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-tick-line{stroke:#475569;}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-axis-tick text{fill:#0f172a;}
  html[data-print-mode='print'] .print-chart .recharts-cartesian-grid line{stroke:#94a3b8;}
  html[data-print-mode='print'] .print-chart svg{filter:grayscale(100%) contrast(1.15);}
  html[data-print-mode='print'] thead th{background:#0f172a;color:#ffffff;}
  html[data-print-mode='print'] tbody tr:nth-child(even){background:#ffffff;}
  html[data-print-mode='print'] .muted{color:#1f2937;}
  @media print{body{background:#ffffff!important;color:#111!important;}[style*='transform'],[class*='transform']{transform:none!important;}h1,h2,h3{break-after:avoid-page!important;page-break-after:avoid!important;overflow:visible!important;line-height:1.2!important;padding-top:0!important;margin-top:0!important;}.keep-with-next{break-after:avoid-page!important;page-break-after:avoid!important;}.no-break-inside,.keep-together{break-inside:avoid-page!important;page-break-inside:avoid!important;}.page-break-before{break-before:page!important;page-break-before:always!important;}.page-break-after{break-after:page!important;page-break-after:always!important;}.chart,img,svg,canvas{max-width:100%!important;height:auto!important;break-inside:avoid-page!important;page-break-inside:avoid!important;}}
  @page{size:A4;margin:14mm 12mm 14mm 12mm;}
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

