import React from 'react'

interface Props {
  selected: string[]
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  onExport: () => void
}

export function UserActionsBar({ selected, onActivate, onDeactivate, onDelete, onExport }: Props) {
  const disabled = selected.length === 0
  return (
    <div className="user-actions">
      <button disabled={disabled} onClick={onActivate}>Activate</button>
      <button disabled={disabled} onClick={onDeactivate}>Deactivate</button>
      <button disabled={disabled} onClick={onDelete}>Delete</button>
      <button onClick={onExport}>Export CSV</button>
    </div>
  )
}
