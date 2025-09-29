import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const workbookMock = {}
  const aoaToSheetMock = vi.fn(() => ({}))
  const bookAppendSheetMock = vi.fn()
  const writeFileMock = vi.fn()
  const createPdfDownloadMock = vi.fn((_: string, callback?: () => void) => {
    callback?.()
  })
  const createPdfMock = vi.fn(() => ({ download: createPdfDownloadMock }))
  const pdfMakeInstance = { vfs: {}, createPdf: createPdfMock }

  return {
    workbookMock,
    aoaToSheetMock,
    bookAppendSheetMock,
    writeFileMock,
    createPdfDownloadMock,
    createPdfMock,
    pdfMakeInstance,
    bookNewMock: vi.fn(() => workbookMock)
  }
})

const {
  workbookMock,
  aoaToSheetMock,
  bookAppendSheetMock,
  writeFileMock,
  createPdfDownloadMock,
  createPdfMock,
  pdfMakeInstance,
  bookNewMock
} = mocks

vi.mock('xlsx', () => ({
  utils: {
    book_new: bookNewMock,
    aoa_to_sheet: aoaToSheetMock,
    book_append_sheet: bookAppendSheetMock
  },
  writeFileXLSX: writeFileMock
}))

vi.mock('pdfmake/build/pdfmake', () => ({
  default: pdfMakeInstance
}))

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { pdfMake: { vfs: { font: 'data' } } }
}))

import { exportCsv, exportExcel, exportPdf, exportAuditLogger } from '../utils/export'

describe('export utilities', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const originalCreateElement = document.createElement
  const originalAppendChild = document.body.appendChild
  const originalRemoveChild = document.body.removeChild

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    document.createElement = originalCreateElement
    document.body.appendChild = originalAppendChild
    document.body.removeChild = originalRemoveChild
  })

  it('exports CSV data with metadata and logs the export', async () => {
    const url = 'blob:csv'
    URL.createObjectURL = vi.fn(() => url)
    URL.revokeObjectURL = vi.fn()

    const clickMock = vi.fn()
    const link = {
      click: clickMock,
      style: {},
      set href(value: string) {
        this._href = value
      },
      get href() {
        return this._href
      },
      set download(value: string) {
        this._download = value
      },
      get download() {
        return this._download
      }
    } as unknown as HTMLAnchorElement & { _href?: string; _download?: string }

    document.createElement = vi.fn(() => link)
    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()

    const entries: unknown[] = []
    const unsubscribe = exportAuditLogger.subscribe(entry => entries.push(entry))

    await exportCsv({
      filename: 'report',
      data: [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' }
      ],
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' }
      ],
      metadata: { module: 'test' }
    })

    unsubscribe()

    expect(link.download).toBe('report.csv')
    expect(link.href).toBe(url)
    expect(clickMock).toHaveBeenCalled()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ type: 'csv', metadata: { module: 'test' } })
  })

  it('builds an Excel workbook with multiple sheets', async () => {
    const entries: unknown[] = []
    const unsubscribe = exportAuditLogger.subscribe(entry => entries.push(entry))

    await exportExcel({
      filename: 'kpis',
      sheets: [
        {
          name: 'Users',
          data: [
            { id: '1', name: 'Alice' }
          ],
          columns: [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Name' }
          ]
        },
        {
          name: 'Stats',
          data: [
            { metric: 'Active', value: 42 }
          ],
          columns: [
            { key: 'metric', header: 'Metric' },
            { key: 'value', header: 'Value' }
          ]
        }
      ],
      metadata: { total: 2 }
    })

    unsubscribe()

    expect(bookNewMock).toHaveBeenCalled()
    expect(aoaToSheetMock).toHaveBeenCalled()
    expect(bookAppendSheetMock).toHaveBeenCalledTimes(3)
    expect(writeFileMock).toHaveBeenCalledWith(workbookMock, 'kpis.xlsx')
    expect(entries[0]).toMatchObject({ type: 'excel', metadata: { total: 2 } })
  })

  it('generates a PDF report and logs the export', async () => {
    const entries: unknown[] = []
    const unsubscribe = exportAuditLogger.subscribe(entry => entries.push(entry))

    await exportPdf({
      filename: 'audit',
      title: 'Audit Trail',
      data: [
        { id: '1', action: 'Login' }
      ],
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'action', header: 'Action' }
      ],
      metadata: { total: 1 }
    })

    unsubscribe()

    expect(createPdfMock).toHaveBeenCalled()
    expect(createPdfDownloadMock).toHaveBeenCalledWith('audit.pdf', expect.any(Function))
    expect(entries[0]).toMatchObject({ type: 'pdf', metadata: { total: 1 } })
  })
})
