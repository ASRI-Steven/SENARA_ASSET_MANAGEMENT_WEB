// Excel helpers untuk Batching Status Asset.
// Kolom baku: "Asset ID" + "Status Target" (Disposal / Inactive / Sold).

export interface BatchExcelRow {
  row: number // baris 1-based di sheet (buat error log)
  assetId: string
  target: string
}

const HEADER_ASSET = ['asset id', 'assetid', 'asset', 'id asset', 'asset_id']
const HEADER_TARGET = ['status target', 'target', 'target status', 'status', 'status_target']

/** Baca file .xlsx/.csv → daftar baris {row, assetId, target}. */
export async function parseBatchExcel(file: File): Promise<BatchExcelRow[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
  return json.map((r, i) => {
    let assetId = ''
    let target = ''
    for (const [k, v] of Object.entries(r)) {
      const kn = String(k).trim().toLowerCase()
      if (!assetId && HEADER_ASSET.includes(kn)) assetId = String(v).trim()
      if (!target && HEADER_TARGET.includes(kn)) target = String(v).trim()
    }
    return { row: i + 2, assetId, target } // +2: baris 1 = header
  })
}

/** Generate + download template .xlsx (Asset ID + Status Target + contoh). */
export async function downloadBatchTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const data = [
    { 'Asset ID': 'AST-0000001', 'Status Target': 'Disposal' },
    { 'Asset ID': 'AST-0000002', 'Status Target': 'Inactive' },
    { 'Asset ID': 'AST-0000003', 'Status Target': 'Sold' },
  ]
  const ws = XLSX.utils.json_to_sheet(data, { header: ['Asset ID', 'Status Target'] })
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Batch')
  XLSX.writeFile(wb, 'template_batching_status_asset.xlsx')
}
