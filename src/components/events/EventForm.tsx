import React, { useEffect, useMemo, useState } from 'react'
import type { Event, EventCategory, EventInput, EventStatus } from '../../services/eventService'

interface EventFormProps {
  event?: Event | null
  categories: EventCategory[]
  availableTags?: string[]
  onSave: (payload: EventInput) => Promise<void> | void
  onCancel: () => void
}

const STATUS_OPTIONS: Array<{ value: EventStatus; label: string }> = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'pending', label: 'En attente' },
  { value: 'published', label: 'Publié' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'archived', label: 'Archivé' }
]

export function EventForm({ event, categories, availableTags = [], onSave, onCancel }: EventFormProps) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [status, setStatus] = useState<EventStatus>(event?.status ?? 'draft')
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '')
  const [startDate, setStartDate] = useState(event?.startDate ?? '')
  const [endDate, setEndDate] = useState(event?.endDate ?? '')
  const [organizer, setOrganizer] = useState(event?.organizer ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [tagsInput, setTagsInput] = useState(event?.tags.join(', ') ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setTitle(event?.title ?? '')
    setDescription(event?.description ?? '')
    setStatus(event?.status ?? 'draft')
    setCategoryId(event?.categoryId ?? '')
    setStartDate(event?.startDate ?? '')
    setEndDate(event?.endDate ?? '')
    setOrganizer(event?.organizer ?? '')
    setLocation(event?.location ?? '')
    setTagsInput(event?.tags.join(', ') ?? '')
  }, [event])

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
    [tagsInput]
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload: EventInput = {
        title,
        description,
        status,
        categoryId: categoryId || undefined,
        startDate,
        endDate: endDate || undefined,
        organizer: organizer || undefined,
        location: location || undefined,
        tags: parsedTags
      }
      await onSave(payload)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = title.trim().length > 0 && startDate.trim().length > 0

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <h2 className="event-form__title">{event ? 'Modifier un événement' : 'Créer un événement'}</h2>
      <div className="event-form__grid">
        <label className="event-form__field">
          <span>Titre</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required />
        </label>
        <label className="event-form__field">
          <span>Statut</span>
          <select value={status} onChange={e => setStatus(e.target.value as EventStatus)}>
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="event-form__field">
          <span>Catégorie</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Aucune catégorie</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="event-form__field">
          <span>Organisateur</span>
          <input value={organizer} onChange={e => setOrganizer(e.target.value)} />
        </label>
        <label className="event-form__field">
          <span>Lieu</span>
          <input value={location} onChange={e => setLocation(e.target.value)} />
        </label>
        <label className="event-form__field">
          <span>Date de début</span>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} required />
        </label>
        <label className="event-form__field">
          <span>Date de fin</span>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </label>
        <label className="event-form__field event-form__field--wide">
          <span>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
        </label>
        <label className="event-form__field event-form__field--wide">
          <span>Tags</span>
          <input
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            placeholder="tag1, tag2"
            list="event-form-tags"
          />
          <datalist id="event-form-tags">
            {availableTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="event-form__actions">
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
