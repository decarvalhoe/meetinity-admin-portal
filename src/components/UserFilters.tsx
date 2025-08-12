import React from 'react'

export interface Filters {
  search: string
  status: string
  industry: string
  startDate: string
  endDate: string
}

interface Props {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
}

export function UserFilters({ filters, onChange }: Props) {
  return (
    <div className="user-filters">
      <input
        placeholder="Search"
        value={filters.search}
        onChange={e => onChange({ search: e.target.value })}
      />
      <select
        value={filters.status}
        onChange={e => onChange({ status: e.target.value })}
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select
        value={filters.industry}
        onChange={e => onChange({ industry: e.target.value })}
      >
        <option value="">All Industries</option>
        <option value="Tech">Tech</option>
        <option value="Finance">Finance</option>
        <option value="Other">Other</option>
      </select>
      <input
        type="date"
        value={filters.startDate}
        onChange={e => onChange({ startDate: e.target.value })}
      />
      <input
        type="date"
        value={filters.endDate}
        onChange={e => onChange({ endDate: e.target.value })}
      />
    </div>
  )
}
