import React from 'react'
import {
  type EscalationPolicy,
  type EscalationStep,
  type NotificationChannel
} from '../../services/alertingService'
import { NotificationChannelPicker } from './NotificationChannelPicker'

export type EscalationEditorMode = 'existing' | 'custom'

export interface EscalationDraft {
  mode: EscalationEditorMode
  policyId?: string
  steps: EscalationStep[]
  repeat?: boolean
}

interface EscalationPolicyEditorProps {
  channels: NotificationChannel[]
  availablePolicies: EscalationPolicy[]
  value: EscalationDraft
  onChange: (draft: EscalationDraft) => void
  disabled?: boolean
}

const DEFAULT_STEP: EscalationStep = { delayMinutes: 0, channelIds: [] }

export function EscalationPolicyEditor({
  channels,
  availablePolicies,
  value,
  onChange,
  disabled
}: EscalationPolicyEditorProps) {
  const handleModeChange = (mode: EscalationEditorMode) => {
    if (disabled) {
      return
    }

    if (mode === 'existing') {
      const firstPolicy = value.policyId
        ? availablePolicies.find(policy => policy.id === value.policyId)
        : availablePolicies[0]
      onChange({
        mode,
        policyId: firstPolicy?.id,
        steps: [],
        repeat: firstPolicy?.repeat ?? false
      })
      return
    }

    onChange({
      mode,
      policyId: undefined,
      steps: value.steps.length > 0 ? value.steps : [DEFAULT_STEP],
      repeat: value.repeat ?? false
    })
  }

  const handlePolicyChange = (policyId: string) => {
    if (disabled) {
      return
    }

    const policy = availablePolicies.find(item => item.id === policyId)
    onChange({
      mode: 'existing',
      policyId,
      steps: [],
      repeat: policy?.repeat ?? false
    })
  }

  const handleStepChange = (index: number, step: EscalationStep) => {
    if (disabled) {
      return
    }

    const nextSteps = value.steps.map((current, idx) => (idx === index ? step : current))
    onChange({ ...value, steps: nextSteps })
  }

  const handleAddStep = () => {
    if (disabled) {
      return
    }

    const nextDelay = value.steps.length > 0 ? value.steps[value.steps.length - 1].delayMinutes + 5 : 5
    onChange({ ...value, steps: [...value.steps, { delayMinutes: nextDelay, channelIds: [] }] })
  }

  const handleRemoveStep = (index: number) => {
    if (disabled) {
      return
    }

    const nextSteps = value.steps.filter((_, idx) => idx !== index)
    onChange({ ...value, steps: nextSteps.length > 0 ? nextSteps : [DEFAULT_STEP] })
  }

  const handleRepeatChange = (repeat: boolean) => {
    if (disabled) {
      return
    }

    onChange({ ...value, repeat })
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '16px'
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Politique d'escalade</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
          Définissez la séquence de notifications envoyées lorsque la condition persiste.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="radio"
            name="escalation-mode"
            value="custom"
            checked={value.mode === 'custom'}
            onChange={() => handleModeChange('custom')}
            disabled={disabled}
          />
          Personnaliser la politique
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="radio"
            name="escalation-mode"
            value="existing"
            checked={value.mode === 'existing'}
            onChange={() => handleModeChange('existing')}
            disabled={disabled || availablePolicies.length === 0}
          />
          Utiliser une politique existante
        </label>
      </div>

      {value.mode === 'existing' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="escalation-policy-select" style={{ fontWeight: 600 }}>
            Politique d'escalade
          </label>
          <select
            id="escalation-policy-select"
            value={value.policyId ?? ''}
            onChange={event => handlePolicyChange(event.target.value)}
            disabled={disabled || availablePolicies.length === 0}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5f5',
              fontSize: '0.95rem'
            }}
          >
            <option value="" disabled>
              {availablePolicies.length === 0
                ? 'Aucune politique disponible'
                : 'Sélectionner une politique'}
            </option>
            {availablePolicies.map(policy => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>
          {value.policyId && (
            <p style={{ margin: 0, color: '#475569', fontSize: '0.875rem' }}>
              {availablePolicies.find(policy => policy.id === value.policyId)?.description ??
                'Les notifications suivront la configuration existante.'}
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {value.steps.map((step, index) => (
            <div
              key={index}
              data-testid={`escalation-step-${index}`}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>Étape {index + 1}</h4>
                {value.steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(index)}
                    disabled={disabled}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: disabled ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Supprimer
                  </button>
                )}
              </div>

              <label htmlFor={`escalation-delay-${index}`} style={{ fontWeight: 600 }}>
                Délai avant l'étape {index + 1} (minutes)
              </label>
              <input
                id={`escalation-delay-${index}`}
                type="number"
                min={0}
                value={step.delayMinutes}
                onChange={event =>
                  handleStepChange(index, {
                    ...step,
                    delayMinutes: Number.parseInt(event.target.value, 10) || 0
                  })
                }
                disabled={disabled}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #cbd5f5',
                  borderRadius: '10px',
                  fontSize: '0.95rem'
                }}
              />

              <NotificationChannelPicker
                legend="Canaux pour cette étape"
                channels={channels}
                selectedChannelIds={step.channelIds}
                onChange={channelIds => handleStepChange(index, { ...step, channelIds })}
                disabled={disabled}
                idPrefix={`escalation-step-${index}-channel`}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddStep}
            disabled={disabled}
            style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px dashed #2563eb',
              backgroundColor: 'transparent',
              color: '#2563eb',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
          >
            Ajouter une étape
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={Boolean(value.repeat)}
              onChange={event => handleRepeatChange(event.target.checked)}
              disabled={disabled}
            />
            Répéter la séquence tant que l'incident est actif
          </label>
        </div>
      )}
    </section>
  )
}

