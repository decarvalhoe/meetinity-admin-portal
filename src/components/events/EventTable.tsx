import React from 'react'
import {
  useReactTable,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel
} from '@tanstack/react-table'
import type { Event } from '../../services/eventService'

interface EventTableProps {
  data: Event[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onSelect: (ids: string[]) => void
  onEdit: (event: Event) => void
  clearSelectionKey?: number
}

export function EventTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onSelect,
  onEdit,
  clearSelectionKey
}: EventTableProps) {
  const [rowSelection, setRowSelection] = React.useState({})

  const columns = React.useMemo<ColumnDef<Event>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
          />
        )
      },
      {
        accessorKey: 'title',
        header: 'Titre'
      },
      {
        accessorKey: 'status',
        header: 'Statut'
      },
      {
        id: 'category',
        header: 'Catégorie',
        cell: ({ row }) => row.original.category?.name ?? '—'
      },
      {
        accessorKey: 'startDate',
        header: 'Début'
      },
      {
        accessorKey: 'endDate',
        header: 'Fin'
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => (row.original.tags.length ? row.original.tags.join(', ') : '—')
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button type="button" onClick={() => onEdit(row.original)}>
            Modifier
          </button>
        )
      }
    ],
    [onEdit]
  )

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    getRowId: row => row.id,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  React.useEffect(() => {
    if (clearSelectionKey !== undefined) {
      setRowSelection({})
    }
  }, [clearSelectionKey])

  React.useEffect(() => {
    onSelect(table.getSelectedRowModel().rows.map(row => row.original.id))
  }, [rowSelection, onSelect, table])

  const safePageSize = pageSize > 0 ? pageSize : 1
  const pageCount = Math.max(1, Math.ceil(total / safePageSize))
  const hasPages = total > 0
  const canGoPrev = hasPages && page > 0
  const canGoNext = hasPages && page + 1 < pageCount

  return (
    <section className="event-table">
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} onClick={header.column.getToggleSortingHandler() as any}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '12px' }}>
                Aucun événement trouvé
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="pagination">
        <button type="button" disabled={!canGoPrev} onClick={() => canGoPrev && onPageChange(page - 1)}>
          Précédent
        </button>
        <span>{hasPages ? `Page ${page + 1} / ${pageCount}` : 'Aucune page'}</span>
        <button type="button" disabled={!canGoNext} onClick={() => canGoNext && onPageChange(page + 1)}>
          Suivant
        </button>
      </div>
    </section>
  )
}
