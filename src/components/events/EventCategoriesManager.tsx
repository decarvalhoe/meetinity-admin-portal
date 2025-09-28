import React, { useState } from 'react'
import { EventService, type EventCategory } from '../../services/eventService'

interface EventCategoriesManagerProps {
  categories: EventCategory[]
  onCategoriesChange: () => Promise<void> | void
}

export function EventCategoriesManager({ categories, onCategoriesChange }: EventCategoriesManagerProps) {
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await EventService.createCategory({ name: name.trim() })
      setName('')
      await onCategoriesChange()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (category: EventCategory) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = async (categoryId: string) => {
    if (!editingName.trim()) {
      return
    }
    setIsSubmitting(true)
    try {
      await EventService.updateCategory(categoryId, { name: editingName.trim() })
      setEditingId(null)
      setEditingName('')
      await onCategoriesChange()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    setIsSubmitting(true)
    try {
      await EventService.deleteCategory(categoryId)
      await onCategoriesChange()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="event-categories">
      <h3>Gestion des catégories</h3>
      <form className="event-categories__create" onSubmit={handleCreate}>
        <input
          placeholder="Nom de la catégorie"
          value={name}
          onChange={event => setName(event.target.value)}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={isSubmitting || name.trim().length === 0}>
          Ajouter
        </button>
      </form>
      <ul className="event-categories__list">
        {categories.map(category => (
          <li key={category.id} className="event-categories__item">
            {editingId === category.id ? (
              <>
                <input value={editingName} onChange={event => setEditingName(event.target.value)} />
                <button type="button" onClick={() => handleSaveEdit(category.id)} disabled={isSubmitting}>
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null)
                    setEditingName('')
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <span className="event-categories__name">{category.name}</span>
                <button type="button" onClick={() => handleStartEdit(category)} disabled={isSubmitting}>
                  Renommer
                </button>
                <button type="button" onClick={() => handleDelete(category.id)} disabled={isSubmitting}>
                  Supprimer
                </button>
              </>
            )}
          </li>
        ))}
        {categories.length === 0 && <li>Aucune catégorie disponible</li>}
      </ul>
    </section>
  )
}
