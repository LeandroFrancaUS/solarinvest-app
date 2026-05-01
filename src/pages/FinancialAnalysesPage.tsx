import { useEffect, useState } from 'react'
import { listFinancialAnalyses, type SavedFinancialAnalysis } from '../services/financialAnalysesApi'

export default function FinancialAnalysesPage() {
  const [data, setData] = useState<SavedFinancialAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listFinancialAnalyses()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6">Carregando análises...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Histórico de Análises Financeiras</h1>

      <div className="grid gap-4">
        {data.map((a) => (
          <div key={a.id} className="border rounded p-4 flex justify-between items-center">
            <div>
              <div className="font-semibold">{a.analysis_name}</div>
              <div className="text-sm text-gray-500">
                {a.mode.toUpperCase()} • {new Date(a.created_at).toLocaleString('pt-BR')}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="border px-3 py-1 rounded"
                onClick={() => window.localStorage.setItem('af:load', JSON.stringify(a))}
              >
                Abrir
              </button>

              <button
                className="border px-3 py-1 rounded"
                onClick={() => exportAnalysisPdf(a)}
              >
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function exportAnalysisPdf(a: SavedFinancialAnalysis) {
  const win = window.open('', '_blank')
  if (!win) return

  const html = `
    <html>
      <head>
        <title>${a.analysis_name}</title>
        <style>
          body { font-family: Arial; padding: 40px; }
          h1 { margin-bottom: 4px }
          .meta { color: #666; margin-bottom: 20px }
          .card { border: 1px solid #ddd; padding: 16px; margin-bottom: 16px; border-radius: 8px }
        </style>
      </head>
      <body>
        <h1>${a.analysis_name}</h1>
        <div class="meta">${a.mode.toUpperCase()} • ${new Date(a.created_at).toLocaleString('pt-BR')}</div>

        <div class="card">
          <h3>Resumo</h3>
          <pre>${JSON.stringify((a.payload_json as Record<string, unknown>)['result'] ?? {}, null, 2)}</pre>
        </div>

        <script>
          window.onload = () => {
            window.print()
          }
        </script>
      </body>
    </html>
  `

  win.document.write(html)
  win.document.close()
}
