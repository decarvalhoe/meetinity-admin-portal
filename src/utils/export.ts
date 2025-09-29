import { utils, writeFileXLSX } from 'xlsx'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

type ExportFormat = 'csv' | 'excel' | 'pdf'

export interface ExportColumn<Row extends Record<string, unknown> = Record<string, unknown>> {
  key: keyof Row & string
  header: string
  formatter?: (value: unknown, row: Row) => unknown
}

export type ExportMetadata = Record<string, unknown>

export interface ExportCsvOptions<Row extends Record<string, unknown> = Record<string, unknown>> {
  filename: string
  data: Row[]
  columns?: ExportColumn<Row>[]
  metadata?: ExportMetadata
  delimiter?: string
  includeBom?: boolean
}

export interface ExportExcelSheet<Row extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  data: Row[]
  columns?: ExportColumn<Row>[]
}

export interface ExportExcelOptions {
  filename: string
  sheets: ExportExcelSheet[]
  metadata?: ExportMetadata
  includeMetadataSheet?: boolean
}

export interface ExportPdfOptions<Row extends Record<string, unknown> = Record<string, unknown>> {
  filename: string
  title?: string
  data: Row[]
  columns: ExportColumn<Row>[]
  metadata?: ExportMetadata
  pageOrientation?: 'portrait' | 'landscape'
}

export interface ExportAuditEntry {
  type: ExportFormat
  filename: string
  rowCount: number
  metadata?: ExportMetadata
  timestamp: string
}

type ExportAuditListener = (entry: ExportAuditEntry) => void

const auditListeners = new Set<ExportAuditListener>()

export const exportAuditLogger = {
  log(entry: Omit<ExportAuditEntry, 'timestamp'>) {
    const enriched: ExportAuditEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    }
    if (auditListeners.size === 0) {
      // eslint-disable-next-line no-console
      console.info('[export]', enriched)
    } else {
      auditListeners.forEach(listener => listener(enriched))
    }
  },
  subscribe(listener: ExportAuditListener) {
    auditListeners.add(listener)
    return () => auditListeners.delete(listener)
  }
}

if (pdfFonts?.pdfMake?.vfs) {
  pdfMake.vfs = pdfFonts.pdfMake.vfs
}

function ensureExtension(filename: string, extension: string) {
  return filename.toLowerCase().endsWith(`.${extension}`) ? filename : `${filename}.${extension}`
}

function normaliseValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function mapRow<Row extends Record<string, unknown>>(row: Row, columns?: ExportColumn<Row>[]) {
  if (!columns || columns.length === 0) {
    return Object.values(row).map(normaliseValue)
  }

  return columns.map(column => {
    const raw = row[column.key]
    const formatted = column.formatter ? column.formatter(raw, row) : raw
    return normaliseValue(formatted)
  })
}

function buildCsvContent<Row extends Record<string, unknown>>(
  data: Row[],
  columns?: ExportColumn<Row>[],
  delimiter = ';'
) {
  if (!data.length && (!columns || columns.length === 0)) {
    return ''
  }

  const headers = columns && columns.length > 0 ? columns.map(column => column.header) : Object.keys(data[0] || {})

  const csvRows = [headers, ...data.map(row => mapRow(row, columns))]

  return csvRows
    .map(row =>
      row
        .map(value => {
          const needsQuote = value.includes(delimiter) || value.includes('"') || value.includes('\n')
          const escaped = value.replace(/"/g, '""')
          return needsQuote ? `"${escaped}"` : escaped
        })
        .join(delimiter)
    )
    .join('\n')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportCsv<Row extends Record<string, unknown>>({
  filename,
  data,
  columns,
  metadata,
  delimiter,
  includeBom
}: ExportCsvOptions<Row>) {
  const csvContent = buildCsvContent(data, columns, delimiter)
  const prefix = includeBom ? '\ufeff' : ''
  const blob = new Blob([prefix, csvContent], { type: 'text/csv;charset=utf-8;' })

  triggerDownload(blob, ensureExtension(filename, 'csv'))
  exportAuditLogger.log({ type: 'csv', filename: ensureExtension(filename, 'csv'), rowCount: data.length, metadata })
}

export async function exportExcel({
  filename,
  sheets,
  metadata,
  includeMetadataSheet = true
}: ExportExcelOptions) {
  if (!sheets.length) {
    return
  }

  const workbook = utils.book_new()

  sheets.forEach(sheet => {
    const headers = sheet.columns && sheet.columns.length > 0 ? sheet.columns.map(column => column.header) : Object.keys(sheet.data[0] || {})
    const dataRows = sheet.data.map(row => mapRow(row, sheet.columns))
    const aoa = headers.length ? [headers, ...dataRows] : dataRows
    const worksheet = utils.aoa_to_sheet(aoa)
    utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  })

  if (metadata && includeMetadataSheet && Object.keys(metadata).length > 0) {
    const metadataRows = Object.entries(metadata).map(([key, value]) => [key, normaliseValue(value)])
    const worksheet = utils.aoa_to_sheet([
      ['Clé', 'Valeur'],
      ...metadataRows
    ])
    utils.book_append_sheet(workbook, worksheet, 'Metadata')
  }

  writeFileXLSX(workbook, ensureExtension(filename, 'xlsx'))
  const totalRows = sheets.reduce((count, sheet) => count + sheet.data.length, 0)
  exportAuditLogger.log({ type: 'excel', filename: ensureExtension(filename, 'xlsx'), rowCount: totalRows, metadata })
}

export async function exportPdf<Row extends Record<string, unknown>>({
  filename,
  title,
  data,
  columns,
  metadata,
  pageOrientation = 'portrait'
}: ExportPdfOptions<Row>) {
  if (!columns.length) {
    return
  }

  const tableBody = [
    columns.map(column => ({ text: column.header, style: 'tableHeader' })),
    ...data.map(row => columns.map(column => ({ text: normaliseValue(column.formatter ? column.formatter(row[column.key], row) : row[column.key]), style: 'tableCell' })))
  ]

  const docDefinition = {
    pageOrientation,
    info: metadata
      ? Object.entries(metadata).reduce<Record<string, unknown>>((info, [key, value]) => {
          info[key] = normaliseValue(value)
          return info
        }, {})
      : undefined,
    content: [
      title
        ? {
            text: title,
            style: 'title',
            margin: [0, 0, 0, 12]
          }
        : null,
      {
        table: {
          headerRows: 1,
          widths: columns.map(() => '*'),
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      }
    ].filter(Boolean),
    styles: {
      title: {
        fontSize: 16,
        bold: true
      },
      tableHeader: {
        bold: true,
        fillColor: '#f2f2f2'
      },
      tableCell: {}
    }
  }

  await new Promise<void>((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).download(ensureExtension(filename, 'pdf'), () => resolve())
    } catch (error) {
      reject(error)
    }
  })

  exportAuditLogger.log({ type: 'pdf', filename: ensureExtension(filename, 'pdf'), rowCount: data.length, metadata })
}
