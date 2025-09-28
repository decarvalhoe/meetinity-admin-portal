import React, { useEffect, useMemo, useState } from 'react'
import {
  ModerationFilters,
  ModerationRule,
  ModerationService
} from '../../services/moderationService'

interface ModerationRulesEditorProps {
  filters: ModerationFilters
  onRulesUpdated?: () => void
}

export function ModerationRulesEditor({ filters, onRulesUpdated }: ModerationRulesEditorProps) {
  const [rules, setRules] = useState<ModerationRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const normalizedFilters = useMemo(() => ({
    ...filters,
    status: undefined,
    severity: filters.severity === 'all' ? undefined : filters.severity,
    contentType: filters.contentType === 'all' ? undefined : filters.contentType,
    ruleId: filters.ruleId || undefined
  }), [filters])

  useEffect(() => {
    let isMounted = true

    const fetchRules = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await ModerationService.getRules(normalizedFilters)
        if (isMounted) {
          setRules(data.sort((a, b) => a.priority - b.priority))
        }
      } catch (err) {
        console.error('Failed to load moderation rules', err)
        if (isMounted) {
          setError('Impossible de charger les règles de modération.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchRules()

    return () => {
      isMounted = false
    }
  }, [normalizedFilters])

  const handleToggle = async (rule: ModerationRule) => {
    setIsSaving(true)
    setError(null)
    try {
      const updated = await ModerationService.toggleRule(rule.id, !rule.enabled)
      setRules(prev =>
        prev.map(r => (r.id === updated.id ? { ...r, enabled: updated.enabled } : r))
      )
      onRulesUpdated?.()
    } catch (err) {
      console.error('Failed to toggle rule', err)
      setError("Impossible de mettre à jour l'état de la règle.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleMove = async (rule: ModerationRule, direction: -1 | 1) => {
    const currentIndex = rules.findIndex(r => r.id === rule.id)
    const targetIndex = currentIndex + direction

    if (targetIndex < 0 || targetIndex >= rules.length) {
      return
    }

    const reordered = [...rules]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    setRules(reordered)
    setIsSaving(true)
    setError(null)

    try {
      await ModerationService.reorderRules(reordered.map(r => r.id))
      onRulesUpdated?.()
    } catch (err) {
      console.error('Failed to reorder rules', err)
      setError('La mise à jour de la priorité a échoué.')
      setRules(rules)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="moderation-rules" data-testid="moderation-rules-editor">
      <header className="moderation-rules__header">
        <h3>Règles automatiques</h3>
        {isSaving && <span>Synchronisation…</span>}
      </header>
      {isLoading && <p>Chargement des règles…</p>}
      {error && <p className="moderation-dashboard__error">{error}</p>}
      {!isLoading && !error && rules.length === 0 && <p>Aucune règle ne correspond aux filtres.</p>}
      <ul className="moderation-rules__list">
        {rules.map(rule => (
          <li key={rule.id} className="moderation-rules__item">
            <div className="moderation-rules__item-header">
              <div>
                <strong>{rule.name}</strong>
                <p>{rule.description}</p>
              </div>
              <div className="moderation-rules__actions">
                <label>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule)}
                    disabled={isSaving}
                    data-testid={`rule-toggle-${rule.id}`}
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={() => handleMove(rule, -1)}
                  disabled={isSaving}
                  aria-label="Priorité supérieure"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(rule, 1)}
                  disabled={isSaving}
                  aria-label="Priorité inférieure"
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="moderation-rules__meta">
              <span>Priorité : {rule.priority}</span>
              <span>Sévérité : {rule.severity}</span>
              {rule.lastTriggeredAt && (
                <span>Dernier déclenchement : {new Date(rule.lastTriggeredAt).toLocaleString()}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
