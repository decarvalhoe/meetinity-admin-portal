import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ModerationAppeal,
  ModerationFilters,
  ModerationService
} from '../../services/moderationService'

interface AppealsQueueProps {
  filters: ModerationFilters
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onDecision?: () => void
}

export function AppealsQueue({ filters, page, pageSize, onPageChange, onDecision }: AppealsQueueProps) {
  const [appeals, setAppeals] = useState<ModerationAppeal[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const requestId = useRef(0)

  const normalizedFilters = useMemo(() => ({
    ...filters,
    severity: filters.severity === 'all' ? undefined : filters.severity,
    contentType: filters.contentType === 'all' ? undefined : filters.contentType,
    ruleId: filters.ruleId || undefined
  }), [filters])

  useEffect(() => {
    let isMounted = true
    const currentRequest = requestId.current + 1
    requestId.current = currentRequest

    const fetchAppeals = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { appeals: data, total: count } = await ModerationService.listAppeals({
          ...normalizedFilters,
          page,
          pageSize
        })

        if (!isMounted || currentRequest !== requestId.current) {
          return
        }

        setAppeals(data)
        setTotal(count)

        if (data.length === 0 && page > 0) {
          onPageChange(Math.max(0, page - 1))
        }
      } catch (err) {
        console.error('Failed to load appeals', err)
        if (isMounted) {
          setError('Impossible de charger la file des appels.')
        }
      } finally {
        if (isMounted && currentRequest === requestId.current) {
          setIsLoading(false)
        }
      }
    }

    fetchAppeals()

    return () => {
      isMounted = false
    }
  }, [normalizedFilters, onPageChange, page, pageSize])

  const handleUpdate = async (appeal: ModerationAppeal, status: ModerationAppeal['status']) => {
    setIsUpdating(true)
    setError(null)

    try {
      const updated = await ModerationService.updateAppeal(appeal.id, { status })
      setAppeals(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      onDecision?.()
    } catch (err) {
      console.error('Failed to update appeal', err)
      setError("La mise à jour de l'appel a échoué.")
    } finally {
      setIsUpdating(false)
    }
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  return (
    <div className="moderation-appeals" data-testid="appeals-queue">
      <header className="moderation-appeals__header">
        <h3>Appels</h3>
        {isUpdating && <span>Traitement…</span>}
      </header>
      {isLoading && <p>Chargement des appels…</p>}
      {error && <p className="moderation-dashboard__error">{error}</p>}
      {!isLoading && !error && appeals.length === 0 && <p>Aucun appel en attente.</p>}
      <ul className="moderation-appeals__list">
        {appeals.map(appeal => (
          <li key={appeal.id} className={`moderation-appeals__item moderation-appeals__item--${appeal.status}`}>
            <div className="moderation-appeals__summary">
              <strong>{appeal.userName || appeal.userId}</strong>
              <span>Rapport #{appeal.reportId}</span>
              <span>Soumis le {new Date(appeal.submittedAt).toLocaleString()}</span>
            </div>
            <div className="moderation-appeals__actions">
              <button
                type="button"
                onClick={() => handleUpdate(appeal, 'approved')}
                disabled={isUpdating}
                data-testid={`appeal-approve-${appeal.id}`}
              >
                Approuver
              </button>
              <button
                type="button"
                onClick={() => handleUpdate(appeal, 'rejected')}
                disabled={isUpdating}
                data-testid={`appeal-reject-${appeal.id}`}
              >
                Rejeter
              </button>
            </div>
            {appeal.notes && <p className="moderation-appeals__notes">{appeal.notes}</p>}
          </li>
        ))}
      </ul>
      <footer className="moderation-appeals__pagination">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={isLoading || page === 0}
        >
          Précédent
        </button>
        <span>
          Page {totalPages === 0 ? 0 : page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={isLoading || totalPages === 0 || page + 1 >= totalPages}
        >
          Suivant
        </button>
      </footer>
    </div>
  )
}
