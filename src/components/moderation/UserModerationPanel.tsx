import React, { useEffect, useState } from 'react'
import {
  MODERATION_STATUS_LABELS,
  ModerationDecisionAction,
  ModerationFilters,
  ModerationService,
  ReportedContent
} from '../../services/moderationService'

interface UserModerationPanelProps {
  report: ReportedContent | null
  onDecisionComplete: (report: ReportedContent) => void
  filters: ModerationFilters
}

const ACTION_LABELS: Record<ModerationDecisionAction, string> = {
  dismiss: 'Rejeter le signalement',
  remove: 'Retirer le contenu',
  restrict: 'Limiter la visibilité',
  warn: 'Avertir le compte',
  ban: 'Suspendre le compte',
  escalate: 'Escalader vers un responsable'
}

export function UserModerationPanel({ report, onDecisionComplete, filters }: UserModerationPanelProps) {
  const [action, setAction] = useState<ModerationDecisionAction>('remove')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    setAction('remove')
    setComment('')
    setError(null)
    setSuccessMessage(null)
  }, [report?.id])

  const handleSubmit = async () => {
    if (!report) {
      return
    }

    if (!comment.trim()) {
      setError('Un commentaire détaillant la décision est obligatoire.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updated = await ModerationService.submitDecision(report.id, {
        action,
        comment: comment.trim(),
        escalate: action === 'escalate'
      })

      onDecisionComplete(updated)
      setSuccessMessage('Décision enregistrée avec succès.')
    } catch (err) {
      console.error('Failed to submit moderation decision', err)
      setError("Impossible d'enregistrer la décision. Réessayez plus tard.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!report) {
    return (
      <div className="moderation-panel" data-testid="moderation-panel-empty">
        <h3>Revue de contenu</h3>
        <p>Sélectionnez un signalement pour afficher les détails et prendre une décision.</p>
      </div>
    )
  }

  return (
    <div className="moderation-panel" data-testid="moderation-panel">
      <header className="moderation-panel__header">
        <h3>Revue de contenu</h3>
        <span className={`moderation-panel__status moderation-panel__status--${report.status}`}>
          {MODERATION_STATUS_LABELS[report.status]}
        </span>
      </header>

      <section className="moderation-panel__section">
        <h4>Contenu signalé</h4>
        <p className="moderation-panel__snippet">{report.snippet}</p>
        <dl className="moderation-panel__details">
          <div>
            <dt>Type</dt>
            <dd>{report.contentType}</dd>
          </div>
          <div>
            <dt>Gravité</dt>
            <dd>{report.severity}</dd>
          </div>
          <div>
            <dt>Raison</dt>
            <dd>{report.reason}</dd>
          </div>
          <div>
            <dt>Signalé par</dt>
            <dd>{report.reporterName || report.reporterId}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{new Date(report.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        {report.evidenceUrls && report.evidenceUrls.length > 0 && (
          <div className="moderation-panel__evidence">
            <h5>Preuves fournies</h5>
            <ul>
              {report.evidenceUrls.map(url => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    Consulter la preuve
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="moderation-panel__section">
        <h4>Décision</h4>
        <label htmlFor="moderation-action">Action</label>
        <select
          id="moderation-action"
          value={action}
          onChange={event => {
            setAction(event.target.value as ModerationDecisionAction)
            setSuccessMessage(null)
          }}
          data-testid="moderation-action-select"
        >
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="moderation-comment">Commentaire *</label>
        <textarea
          id="moderation-comment"
          value={comment}
          onChange={event => {
            setComment(event.target.value)
            setError(null)
            setSuccessMessage(null)
          }}
          placeholder="Expliquez la décision prise et la suite prévue"
          rows={4}
          required
          data-testid="moderation-comment"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !comment.trim()}
          data-testid="moderation-submit"
        >
          {isSubmitting ? 'Enregistrement…' : 'Appliquer la décision'}
        </button>

        {error && <p className="moderation-dashboard__error">{error}</p>}
        {successMessage && <p className="moderation-panel__success">{successMessage}</p>}
      </section>

      <footer className="moderation-panel__footer">
        <h4>Contexte des filtres</h4>
        <ul>
          <li>Statut filtré : {filters.status || 'Tous'}</li>
          <li>Gravité filtrée : {filters.severity || 'Toutes'}</li>
          <li>Type filtré : {filters.contentType || 'Tous'}</li>
        </ul>
      </footer>
    </div>
  )
}
