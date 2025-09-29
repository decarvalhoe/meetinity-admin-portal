import React, { useEffect, useMemo, useState } from 'react'
import {
  type AlertCondition,
  type AlertRule,
  type AlertRuleInput,
  type NotificationChannel,
  type EscalationPolicy,
  type RuleEscalationConfig,
  type EscalationStep,
  AlertWindowAggregation
} from '../../services/alertingService'
import { NotificationChannelPicker } from './NotificationChannelPicker'
import { EscalationPolicyEditor, type EscalationDraft } from './EscalationPolicyEditor'

export interface AlertMetricOption {
  id: string
  label: string
  unit?: string
}

interface AlertRuleBuilderProps {
  rule?: AlertRule | null
  metrics: AlertMetricOption[]
  channels: NotificationChannel[]
  escalationPolicies: EscalationPolicy[]
  onSave: (input: AlertRuleInput) => Promise<void>
  canManage: boolean
  isSaving: boolean
  error?: string | null
  successMessage?: string | null
}

const OPERATOR_LABELS: Record<AlertCondition['operator'], string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  neq: '≠'
}

const AGGREGATION_LABELS: Record<AlertWindowAggregation, string> = {
  avg: 'Moyenne',
  max: 'Maximum',
  min: 'Minimum',
  sum: 'Somme'
}

interface ConditionFormState {
  metric: string
  operator: AlertCondition['operator']
  threshold: string
  windowMinutes: string
  aggregation: AlertWindowAggregation
}

const DEFAULT_CONDITION_STATE: ConditionFormState = {
  metric: '',
  operator: 'gt',
  threshold: '',
  windowMinutes: '5',
  aggregation: 'avg'
}

const createDefaultEscalation = (): EscalationDraft => ({
  mode: 'custom',
  steps: [{ delayMinutes: 0, channelIds: [] }],
  repeat: false
})

export function AlertRuleBuilder({
  rule,
  metrics,
  channels,
  escalationPolicies,
  onSave,
  canManage,
  isSaving,
  error,
  successMessage
}: AlertRuleBuilderProps) {
  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [severity, setSeverity] = useState<'warning' | 'critical'>(rule?.severity ?? 'warning')
  const [enabled, setEnabled] = useState<boolean>(rule?.enabled ?? true)
  const [condition, setCondition] = useState<ConditionFormState>(DEFAULT_CONDITION_STATE)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(rule?.channelIds ?? [])
  const [escalation, setEscalation] = useState<EscalationDraft>(() => createDefaultEscalation())
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!rule) {
      setName('')
      setDescription('')
      setSeverity('warning')
      setEnabled(true)
      setCondition(prev => ({
        ...DEFAULT_CONDITION_STATE,
        metric: metrics[0]?.id ?? prev.metric
      }))
      setSelectedChannels([])
      setEscalation(
        escalationPolicies.length > 0
          ? {
              mode: 'existing',
              policyId: escalationPolicies[0].id,
              steps: [],
              repeat: escalationPolicies[0].repeat ?? false
            }
          : createDefaultEscalation()
      )
      return
    }

    const ruleCondition = rule.conditions[0]
    setName(rule.name)
    setDescription(rule.description ?? '')
    setSeverity(rule.severity)
    setEnabled(rule.enabled)
    setCondition({
      metric: ruleCondition?.metric ?? metrics[0]?.id ?? '',
      operator: ruleCondition?.operator ?? 'gt',
      threshold: ruleCondition?.threshold != null ? String(ruleCondition.threshold) : '',
      windowMinutes:
        ruleCondition?.window?.durationMinutes != null
          ? String(ruleCondition.window.durationMinutes)
          : DEFAULT_CONDITION_STATE.windowMinutes,
      aggregation: ruleCondition?.window?.aggregation ?? 'avg'
    })
    setSelectedChannels(rule.channelIds)
    setEscalation(() => {
      const base = rule.escalation
      if (!base) {
        return escalationPolicies.length > 0
          ? {
              mode: 'existing',
              policyId: escalationPolicies[0].id,
              steps: [],
              repeat: escalationPolicies[0].repeat ?? false
            }
          : createDefaultEscalation()
      }

      if (base.policyId) {
        const policy = escalationPolicies.find(item => item.id === base.policyId)
        return {
          mode: 'existing',
          policyId: base.policyId,
          steps: [],
          repeat: base.repeat ?? policy?.repeat ?? false
        }
      }

      return {
        mode: 'custom',
        steps:
          base.steps && base.steps.length > 0
            ? base.steps
            : createDefaultEscalation().steps,
        repeat: base.repeat ?? false
      }
  })
  }, [rule, metrics, escalationPolicies])

  useEffect(() => {
    setLocalError(null)
  }, [rule])

  const currentMetricOptions = useMemo(() => metrics, [metrics])

  useEffect(() => {
    if (condition.metric || currentMetricOptions.length === 0) {
      return
    }
    setCondition(prev => ({ ...prev, metric: currentMetricOptions[0]?.id ?? '' }))
  }, [condition.metric, currentMetricOptions])

  const handleAggregationChange = (aggregation: AlertWindowAggregation) => {
    setCondition(prev => ({ ...prev, aggregation }))
  }

  const handleOperatorChange = (operator: AlertCondition['operator']) => {
    setCondition(prev => ({ ...prev, operator }))
  }

  const mapFormToCondition = (): AlertCondition | null => {
    const metricOption = currentMetricOptions.find(option => option.id === condition.metric)
    if (!metricOption) {
      return null
    }

    const threshold = Number.parseFloat(condition.threshold)
    const windowMinutes = Number.parseInt(condition.windowMinutes, 10)

    if (Number.isNaN(threshold) || Number.isNaN(windowMinutes) || windowMinutes <= 0) {
      return null
    }

    return {
      metric: metricOption.id,
      operator: condition.operator,
      threshold,
      window: {
        durationMinutes: windowMinutes,
        aggregation: condition.aggregation
      }
    }
  }

  const validateForm = (): boolean => {
    const errors: string[] = []

    if (!name.trim()) {
      errors.push('Le nom de la règle est requis.')
    }

    if (!condition.metric) {
      errors.push('Sélectionnez une métrique pour surveiller la condition.')
    }

    const threshold = Number.parseFloat(condition.threshold)
    if (Number.isNaN(threshold)) {
      errors.push('Le seuil doit être un nombre valide.')
    }

    const windowMinutes = Number.parseInt(condition.windowMinutes, 10)
    if (Number.isNaN(windowMinutes) || windowMinutes <= 0) {
      errors.push('La fenêtre glissante doit être supérieure à zéro.')
    }

    if (selectedChannels.length === 0) {
      errors.push('Sélectionnez au moins un canal de notification.')
    }

    if (escalation.mode === 'existing' && !escalation.policyId) {
      errors.push("Choisissez une politique d'escalade existante ou personnalisez la séquence.")
    }

    if (escalation.mode === 'custom') {
      const invalidStep = escalation.steps.some(step => step.channelIds.length === 0)
      if (escalation.steps.length === 0 || invalidStep) {
        errors.push('Chaque étape personnalisée doit notifier au moins un canal.')
      }
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  const buildEscalationPayload = (): RuleEscalationConfig | null => {
    if (escalation.mode === 'existing') {
      return escalation.policyId ? { policyId: escalation.policyId, repeat: escalation.repeat } : null
    }

    const steps: EscalationStep[] = escalation.steps.map(step => ({
      delayMinutes: step.delayMinutes,
      channelIds: step.channelIds
    }))

    return {
      steps,
      repeat: escalation.repeat
    }
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault()

    if (!canManage) {
      setLocalError("Vous n'avez pas l'autorisation de modifier les alertes.")
      return
    }

    setLocalError(null)

    if (!validateForm()) {
      return
    }

    const conditionPayload = mapFormToCondition()
    if (!conditionPayload) {
      setLocalError('Les paramètres de la condition sont invalides.')
      return
    }

    const payload: AlertRuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      severity,
      enabled,
      conditions: [conditionPayload],
      channelIds: selectedChannels,
      escalation: buildEscalationPayload()
    }

    try {
      await onSave(payload)
      setValidationErrors([])
    } catch (err) {
      const message = err instanceof Error ? err.message : "La sauvegarde de la règle a échoué."
      setLocalError(message)
    }
  }

  const currentMetricLabel = useMemo(() => {
    const option = currentMetricOptions.find(item => item.id === condition.metric)
    if (!option || !option.unit) {
      return null
    }
    return option.unit
  }, [condition.metric, currentMetricOptions])

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
          {rule ? `Modifier la règle « ${rule.name} »` : 'Créer une règle d\'alerte'}
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
          Définissez une condition de déclenchement et les canaux de notification correspondants.
        </p>
      </header>

      {successMessage && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.35)',
            color: '#0f5132',
            padding: '12px 16px',
            borderRadius: '10px'
          }}
        >
          {successMessage}
        </div>
      )}

      {(error || localError) && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(248,113,113,0.12)',
            border: '1px solid rgba(248,113,113,0.35)',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '10px'
          }}
        >
          {localError || error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#b91c1c', fontSize: '0.9rem' }}>
          {validationErrors.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-rule-name" style={{ fontWeight: 600 }}>
            Nom de la règle
          </label>
          <input
            id="alert-rule-name"
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            disabled={!canManage}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-rule-severity" style={{ fontWeight: 600 }}>
            Sévérité
          </label>
          <div id="alert-rule-severity" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="radio"
                name="alert-rule-severity"
                value="warning"
                checked={severity === 'warning'}
                onChange={() => setSeverity('warning')}
                disabled={!canManage}
              />
              Avertissement
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="radio"
                name="alert-rule-severity"
                value="critical"
                checked={severity === 'critical'}
                onChange={() => setSeverity('critical')}
                disabled={!canManage}
              />
              Critique
            </label>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
            disabled={!canManage}
          />
          Activer la règle
        </label>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-rule-description" style={{ fontWeight: 600 }}>
            Description (facultatif)
          </label>
          <textarea
            id="alert-rule-description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            disabled={!canManage}
            rows={3}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem',
              resize: 'vertical'
            }}
          />
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-condition-metric" style={{ fontWeight: 600 }}>
            Métrique surveillée
          </label>
          <select
            id="alert-condition-metric"
            value={condition.metric}
            onChange={event => setCondition(prev => ({ ...prev, metric: event.target.value }))}
            disabled={!canManage || currentMetricOptions.length === 0}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          >
            {currentMetricOptions.length === 0 && <option value="">Aucune métrique disponible</option>}
            {currentMetricOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-condition-operator" style={{ fontWeight: 600 }}>
            Opérateur
          </label>
          <select
            id="alert-condition-operator"
            value={condition.operator}
            onChange={event => handleOperatorChange(event.target.value as AlertCondition['operator'])}
            disabled={!canManage}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          >
            {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-condition-threshold" style={{ fontWeight: 600 }}>
            Seuil {currentMetricLabel ? `(${currentMetricLabel})` : ''}
          </label>
          <input
            id="alert-condition-threshold"
            type="number"
            value={condition.threshold}
            onChange={event => setCondition(prev => ({ ...prev, threshold: event.target.value }))}
            disabled={!canManage}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-condition-window" style={{ fontWeight: 600 }}>
            Fenêtre glissante (minutes)
          </label>
          <input
            id="alert-condition-window"
            type="number"
            min={1}
            value={condition.windowMinutes}
            onChange={event => setCondition(prev => ({ ...prev, windowMinutes: event.target.value }))}
            disabled={!canManage}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label htmlFor="alert-condition-aggregation" style={{ fontWeight: 600 }}>
            Agrégation
          </label>
          <select
            id="alert-condition-aggregation"
            value={condition.aggregation}
            onChange={event => handleAggregationChange(event.target.value as AlertWindowAggregation)}
            disabled={!canManage}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          >
            {Object.entries(AGGREGATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <NotificationChannelPicker
        channels={channels}
        selectedChannelIds={selectedChannels}
        onChange={setSelectedChannels}
        disabled={!canManage}
      />

      <EscalationPolicyEditor
        channels={channels}
        availablePolicies={escalationPolicies}
        value={escalation}
        onChange={draft => setEscalation(draft)}
        disabled={!canManage}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={!canManage || isSaving}
          style={{
            padding: '12px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: !canManage ? '#94a3b8' : '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: !canManage || isSaving ? 'not-allowed' : 'pointer',
            minWidth: '220px'
          }}
        >
          {isSaving ? 'Sauvegarde en cours...' : 'Sauvegarder la règle'}
        </button>
      </div>
    </form>
  )
}

