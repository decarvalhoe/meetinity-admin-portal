import React from 'react'
import {
  useReactTable,
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table'
import { User } from '../services/userService'

interface Props {
  data: User[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onSelect: (ids: string[]) => void
  clearSelectionKey?: number
}

export function UserTable({
  data,
  total,
  page,
  pageSize,
  onPageChange,
  onSelect,
  clearSelectionKey
}: Props) {
  const [rowSelection, setRowSelection] = React.useState({})

  const columns = React.useMemo<ColumnDef<User>[]>(
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
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'industry', header: 'Industry' },
      { accessorKey: 'createdAt', header: 'Created' }
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: row => row.id
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
    <div className="user-table">
      <table>
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => (
                <th key={h.id} onClick={h.column.getToggleSortingHandler() as any}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
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
        </tbody>
      </table>
      <div className="pagination">
        <button
          disabled={!canGoPrev}
          onClick={() => {
            if (canGoPrev) {
              onPageChange(page - 1)
            }
          }}
        >
          Prev
        </button>
        <span>
          {hasPages ? (
            <>Page {page + 1} / {pageCount}</>
          ) : (
            'No pages available'
          )}
        </span>
        <button
          disabled={!canGoNext}
          onClick={() => {
            if (canGoNext) {
              onPageChange(page + 1)
            }
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
