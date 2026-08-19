// Self-generated PDF report for the asset list. Replaces the legacy SSRS/ASP
// report (CsReport → apps.alam-sutera.com/AsriReport 'PrintOut_LaporanAsset').
//
// buildAssetReport() takes the current filter params + a human-readable filter
// summary, fetches ALL matching assets by paging the search SP, then renders a
// landscape A4 PDF (header + filter summary + autotable + page numbers) and
// triggers a browser download. It only READS (search) — no mutations.

import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import {
  searchAssets,
  type AssetRow,
  type AssetSearchParams,
} from '@/api/assets'
import { numberWithDots, rupiah, toNumber } from '@/lib/format'

// How many rows to pull per page while gathering the full result set. The SP
// accepts an arbitrary PageSize; 1000 keeps each request modest.
const FETCH_PAGE_SIZE = 1000
// No row cap — the report prints EVERY matching asset (parity with the legacy
// SSRS report, which had no client-side limit). For a huge unfiltered export the
// caller warns the user first (see handlePrintReport).

export interface AssetReportOptions {
  /** The active search params (same object the grid uses), minus paging. */
  params: Omit<AssetSearchParams, 'CurrentPage' | 'PageSize'>
  /** One "Label: value" line per active filter, for the report header. */
  filterSummary: string[]
  /** Report title (e.g. "Laporan Aset"). */
  title?: string
}

export interface AssetReportResult {
  /** Downloaded file name. */
  fileName: string
  /** Rows included in the PDF. */
  rowCount: number
  /** Total matching records reported by the SP (may exceed rowCount if capped). */
  totalRecords: number
  /** True when the export hit MAX_ROWS and some rows were left out. */
  truncated: boolean
}

/** "2026-07-28" for filenames; locale-independent, no separators to escape. */
function fileDateStamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "28 Jul 2026, 14.30" — Indonesian long timestamp for the report header. */
function headerTimestamp(d: Date): string {
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Page through the search SP until every matching row is collected. Returns the
 * rows plus the SP's reported total for the report header.
 */
async function fetchAllAssets(
  params: AssetReportOptions['params'],
): Promise<{ rows: AssetRow[]; totalRecords: number; truncated: boolean }> {
  const all: AssetRow[] = []
  let currentPage = 1
  let maxPage = 1
  let totalRecords = 0

  do {
    const res = await searchAssets({
      ...params,
      CurrentPage: currentPage,
      PageSize: FETCH_PAGE_SIZE,
    })
    all.push(...res.rows)
    if (res.page) {
      maxPage = res.page.MaxPage || 1
      totalRecords = res.page.TotalRecords || all.length
    }
    // Stop early if the SP returned nothing (guards against a bad MaxPage).
    if (res.rows.length === 0) break
    currentPage += 1
  } while (currentPage <= maxPage)

  // No cap: every matching row is included. `truncated` is kept in the result
  // shape for API stability but is always false now.
  return { rows: all, totalRecords: totalRecords || all.length, truncated: false }
}

/** Compose the "Type/Model" cell, gracefully handling a missing model. */
function typeModel(a: AssetRow): string {
  const t = a.AssetTypeName || '-'
  return a.AssetTypeModelName ? `${t} / ${a.AssetTypeModelName}` : t
}

/**
 * Fetch all matching assets and build + download a landscape A4 PDF report.
 * Resolves with a small summary (file name, counts, truncation flag) so the
 * caller can surface a toast. Rejects if the search fails.
 */
export async function buildAssetReport(
  opts: AssetReportOptions,
): Promise<AssetReportResult> {
  const title = opts.title ?? 'Laporan Aset'
  const { rows, totalRecords, truncated } = await fetchAllAssets(opts.params)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 12
  const generatedAt = new Date()

  // --- Header block -------------------------------------------------------
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(title, marginX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`Dicetak: ${headerTimestamp(generatedAt)}`, marginX, 22)

  const totalLabel = truncated
    ? `Total: ${numberWithDots(totalRecords)} aset (menampilkan ${numberWithDots(rows.length)})`
    : `Total: ${numberWithDots(totalRecords)} aset`
  doc.text(totalLabel, marginX, 27)

  // Filter summary — wrap onto multiple lines within the page width.
  let filterBottomY = 27
  if (opts.filterSummary.length > 0) {
    const filterText = `Filter: ${opts.filterSummary.join('  •  ')}`
    const wrapped = doc.splitTextToSize(filterText, pageWidth - marginX * 2) as string[]
    doc.text(wrapped, marginX, 32)
    filterBottomY = 32 + (wrapped.length - 1) * 4
  }

  const tableStartY = filterBottomY + 6

  // --- Table --------------------------------------------------------------
  const head = [[
    'No',
    'Asset ID',
    'Type / Model',
    'Brand',
    'Status',
    'User',
    'Location',
    'Company',
    'Nilai',
  ]]

  const body = rows.map((a, i) => [
    String(i + 1),
    a.AssetID || '-',
    typeModel(a),
    a.AssetBrandName || '-',
    a.CurrentAssetStatus || '-',
    a.CurrentAssetUser || '-',
    a.CurrentAssetLocation || '-',
    a.CompanyAlias || a.CompanyName || '-',
    rupiah(Math.round(toNumber(a.UnitPrice))),
  ])

  autoTable(doc, {
    head,
    body,
    startY: tableStartY,
    margin: { left: marginX, right: marginX, bottom: 16 },
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [30, 64, 124], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'right' },
      1: { cellWidth: 30 },
      2: { cellWidth: 50 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 40 },
      6: { cellWidth: 34 },
      7: { cellWidth: 24 },
      8: { cellWidth: 28, halign: 'right' },
    },
    // Left footer label on each page. The page numbers ("Halaman X / Y") need
    // the final page total, which isn't known until the table has finished
    // drawing, so they're stamped in a second pass below.
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text('Senara — Manage Asset', marginX, pageHeight - 8)
    },
  })

  // Second pass: now that the table is fully laid out we know the real page
  // count, so stamp "Halaman X / Y" on every page.
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(
      `Halaman ${p} / ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: 'right' },
    )
  }

  const fileName = `Laporan-Aset-${fileDateStamp(generatedAt)}.pdf`
  doc.save(fileName)

  return { fileName, rowCount: rows.length, totalRecords, truncated }
}
