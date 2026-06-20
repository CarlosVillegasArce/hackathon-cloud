const REQUIRED = ['id_reclamo', 'texto']

export default function CsvPreview({ headers, rows, totalRows }) {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  const missing = REQUIRED.filter((req) => !normalized.includes(req))
  const ok = missing.length === 0

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Vista previa</h3>
          <p className="text-xs text-slate-500">
            Mostrando {rows.length} de {totalRows} filas. Validación de columnas obligatorias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {REQUIRED.map((req) => {
            const present = normalized.includes(req)
            return (
              <span
                key={req}
                className={`badge ${
                  present ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {present ? '✓' : '✕'} {req}
              </span>
            )
          })}
        </div>
      </div>

      {!ok && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Falta la columna obligatoria{' '}
          <strong>{missing.join(', ')}</strong>. Corrige el CSV y vuelve a cargarlo.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-4 py-2 text-left font-medium text-slate-600"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                {headers.map((h) => (
                  <td key={h} className="max-w-xs truncate px-4 py-2 text-slate-700">
                    {row[h] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={headers.length || 1}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  El CSV no tiene filas de datos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function validateCsvHeaders(headers) {
  const normalized = headers.map((h) => h.trim().toLowerCase())
  const missing = REQUIRED.filter((req) => !normalized.includes(req))
  return { ok: missing.length === 0, missing }
}
