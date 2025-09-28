import React, { useMemo, useState } from 'react'

interface EventActionsBarProps {
  selected: string[]
  onApprove: () => void
  onReject: () => void
  onArchive: () => void
  onCreate: () => void
  onManageCategories: () => void
  onRefresh: () => void
  onApplyTags: (tags: string[]) => void
  availableTags: string[]
}

export function EventActionsBar({
  selected,
  onApprove,
  onReject,
  onArchive,
  onCreate,
  onManageCategories,
  onRefresh,
  onApplyTags,
  availableTags
}: EventActionsBarProps) {
  const [tagsInput, setTagsInput] = useState('')

  const isSelectionEmpty = selected.length === 0
  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
    [tagsInput]
  )

  const canApplyTags = parsedTags.length > 0 && !isSelectionEmpty

  const handleApplyTags = () => {
    if (parsedTags.length === 0) {
      return
    }
    onApplyTags(parsedTags)
    setTagsInput('')
  }

  return (
    <section className="event-actions">
      <div className="event-actions__primary">
        <button type="button" onClick={onCreate}>
          Créer un événement
        </button>
        <button type="button" onClick={onManageCategories}>
          Gérer les catégories
        </button>
        <button type="button" onClick={onRefresh}>
          Rafraîchir
        </button>
      </div>
      <div className="event-actions__bulk">
        <label className="event-actions__tags-field">
          <span className="event-actions__label">Tags</span>
          <input
            placeholder="tag1, tag2"
            value={tagsInput}
            onChange={event => setTagsInput(event.target.value)}
            list="event-tags-suggestions"
          />
          <datalist id="event-tags-suggestions">
            {availableTags.map(tag => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </label>
        <button type="button" disabled={!canApplyTags} onClick={handleApplyTags}>
          Appliquer les tags
        </button>
        <button type="button" disabled={isSelectionEmpty} onClick={onApprove}>
          Approuver
        </button>
        <button type="button" disabled={isSelectionEmpty} onClick={onReject}>
          Rejeter
        </button>
        <button type="button" disabled={isSelectionEmpty} onClick={onArchive}>
          Archiver
        </button>
      </div>
    </section>
  )
}
