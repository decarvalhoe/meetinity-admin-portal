import React from 'react'
import type { EventCategory } from '../../services/eventService'

export interface EventFiltersState {
  search: string
  status: string
  categoryId: string
  startDate: string
  endDate: string
}

interface EventFiltersProps {
  filters: EventFiltersState
  onChange: (filters: Partial<EventFiltersState>) => void
  categories: EventCategory[]
  statuses?: Array<{ value: string; label: string }>
  disableStatus?: boolean
}

export function EventFilters({ filters, onChange, categories, statuses, disableStatus }: EventFiltersProps) {
  const statusOptions =
    statuses ?? (
      [
        { value: '', label: 'Tous les statuts' },
        { value: 'draft', label: 'Brouillons' },
        { value: 'pending', label: 'En attente' },
        { value: 'published', label: 'Publiés' },
        { value: 'rejected', label: 'Rejetés' },
        { value: 'archived', label: 'Archivés' }
      ] as Array<{ value: string; label: string }>
    )

  return (
    <section className="event-filters">
      <div className="event-filters__row">
        <label className="event-filters__field">
          <span className="event-filters__label">Recherche</span>
          <input
            placeholder="Rechercher un événement"
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
          />
        </label>
        <label className="event-filters__field">
          <span className="event-filters__label">Statut</span>
          <select
            value={filters.status}
            disabled={disableStatus}
            onChange={e => onChange({ status: e.target.value })}
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="event-filters__field">
          <span className="event-filters__label">Catégorie</span>
          <select value={filters.categoryId} onChange={e => onChange({ categoryId: e.target.value })}>
            <option value="">Toutes les catégories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="event-filters__row">
        <label className="event-filters__field">
          <span className="event-filters__label">Date de début</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => onChange({ startDate: e.target.value })}
          />
        </label>
        <label className="event-filters__field">
          <span className="event-filters__label">Date de fin</span>
          <input type="date" value={filters.endDate} onChange={e => onChange({ endDate: e.target.value })} />
        </label>
      </div>
    </section>
  )
}
