import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AbTest,
  AbTestVariant,
  ConfigurationService,
  ConfigurationSnapshot,
  ConfigurationVersion,
  EmailTemplate,
  FeatureFlag,
  NotificationRule,
  PlatformParameter,
  RateLimitRule
} from '../../services/configurationService'

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '24px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)'
}

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px'
}

const sectionSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#4b5563',
  fontSize: '0.95rem'
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
  marginBottom: '16px'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  color: '#1f2937',
  marginBottom: '4px'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '0.95rem'
}

const helperTextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.85rem',
  marginTop: '4px'
}

const errorTextStyle: React.CSSProperties = {
  color: '#b91c1c',
  fontSize: '0.85rem',
  marginTop: '4px'
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer'
}

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#111827'
}

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  border: '1px solid #d1d5db',
  borderRadius: '10px'
}

const templateToolbarStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '12px'
}

const toolbarButtonStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '6px 10px',
  backgroundColor: '#f3f4f6',
  cursor: 'pointer',
  fontSize: '0.85rem'
}

const diffLineStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: '0.85rem',
  padding: '4px 8px',
  borderRadius: '6px'
}

const previewContainerStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '16px',
  backgroundColor: '#f9fafb'
}

interface EmailTemplateDiffLine {
  type: 'unchanged' | 'changed'
  original: string
  updated: string
}

function computeDiff(original: string, updated: string): EmailTemplateDiffLine[] {
  const originalLines = original.split('\n')
  const updatedLines = updated.split('\n')
  const max = Math.max(originalLines.length, updatedLines.length)
  const diff: EmailTemplateDiffLine[] = []

  for (let index = 0; index < max; index += 1) {
    const originalLine = originalLines[index] ?? ''
    const updatedLine = updatedLines[index] ?? ''

    diff.push({
      type: originalLine === updatedLine ? 'unchanged' : 'changed',
      original: originalLine,
      updated: updatedLine
    })
  }

  return diff
}

function formatDate(value?: string) {
  if (!value) {
    return '—'
  }

  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

interface TemplateEditorProps {
  template: EmailTemplate
  original: EmailTemplate | undefined
  onChange: (changes: Partial<EmailTemplate>) => void
  onSave: () => void
  onPreview: () => Promise<void>
  isSaving: boolean
  previewHtml: string | null
  previewPlainText: string | null
  errors: Record<string, string>
}

function TemplateEditor({
  template,
  original,
  onChange,
  onSave,
  onPreview,
  isSaving,
  previewHtml,
  previewPlainText,
  errors
}: TemplateEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== template.htmlContent) {
      editorRef.current.innerHTML = template.htmlContent
    }
  }, [template.htmlContent])

  const handleCommand = useCallback((command: string) => {
    document.execCommand(command)
  }, [])

  const diff = useMemo(
    () => computeDiff(original?.htmlContent || '', template.htmlContent || ''),
    [original?.htmlContent, template.htmlContent]
  )

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div>
        <label htmlFor={`template-subject-${template.id}`} style={labelStyle}>
          Sujet de l'email
        </label>
        <input
          id={`template-subject-${template.id}`}
          style={inputStyle}
          value={template.subject}
          onChange={event => onChange({ subject: event.target.value })}
        />
        {errors.subject && <p style={errorTextStyle}>{errors.subject}</p>}
      </div>

      <div>
        <div style={labelStyle}>Contenu HTML</div>
        <div style={templateToolbarStyle} role="toolbar" aria-label="Outils de mise en forme">
          <button type="button" style={toolbarButtonStyle} onClick={() => handleCommand('bold')}>
            Gras
          </button>
          <button type="button" style={toolbarButtonStyle} onClick={() => handleCommand('italic')}>
            Italique
          </button>
          <button type="button" style={toolbarButtonStyle} onClick={() => handleCommand('insertUnorderedList')}>
            Liste
          </button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          style={{
            ...inputStyle,
            minHeight: '180px',
            border: '1px solid #d1d5db',
            backgroundColor: '#fff',
            overflowY: 'auto'
          }}
          onInput={event =>
            onChange({ htmlContent: (event.target as HTMLDivElement).innerHTML })
          }
          suppressContentEditableWarning
        />
        {errors.htmlContent && <p style={errorTextStyle}>{errors.htmlContent}</p>}
      </div>

      <div>
        <label htmlFor={`template-plain-${template.id}`} style={labelStyle}>
          Version texte simple
        </label>
        <textarea
          id={`template-plain-${template.id}`}
          style={{ ...inputStyle, minHeight: '140px', fontFamily: 'monospace' }}
          value={template.plainTextContent}
          onChange={event => onChange({ plainTextContent: event.target.value })}
        />
        {errors.plainTextContent && <p style={errorTextStyle}>{errors.plainTextContent}</p>}
      </div>

      <div>
        <h4 style={{ marginBottom: '8px' }}>Diff des changements</h4>
        <div style={{ display: 'grid', gap: '4px' }}>
          {diff.map((line, index) => (
            <div
              key={`${line.type}-${index}`}
              style={{
                ...diffLineStyle,
                backgroundColor: line.type === 'changed' ? '#fef3c7' : '#f9fafb'
              }}
            >
              <span>{line.original}</span>
              <span>{line.updated}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" style={buttonStyle} onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Enregistrement...' : 'Enregistrer le template'}
        </button>
        <button type="button" style={secondaryButtonStyle} onClick={onPreview}>
          Générer un aperçu
        </button>
      </div>

      {(previewHtml || previewPlainText) && (
        <div style={previewContainerStyle}>
          <h4>Aperçu rendu</h4>
          {previewHtml && (
            <div
              style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
          {previewPlainText && (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0 }}>{previewPlainText}</pre>
          )}
        </div>
      )}
    </div>
  )
}

export function PlatformSettings() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [parameters, setParameters] = useState<PlatformParameter[]>([])
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [experiments, setExperiments] = useState<AbTest[]>([])
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [notificationRules, setNotificationRules] = useState<NotificationRule[]>([])
  const [rateLimitRules, setRateLimitRules] = useState<RateLimitRule[]>([])
  const [currentVersion, setCurrentVersion] = useState<ConfigurationVersion | null>(null)
  const [history, setHistory] = useState<ConfigurationVersion[]>([])
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [rateLimitsTouched, setRateLimitsTouched] = useState(false)
  const [rateLimitErrors, setRateLimitErrors] = useState<Record<string, string>>({})
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewPlainText, setPreviewPlainText] = useState<string | null>(null)
  const [originalTemplates, setOriginalTemplates] = useState<Record<string, EmailTemplate>>({})

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [snapshot, versions] = await Promise.all([
        ConfigurationService.getSnapshot(),
        ConfigurationService.getVersionHistory()
      ])

      setParameters(snapshot.parameters)
      setFeatureFlags(snapshot.featureFlags)
      setExperiments(snapshot.experiments)
      setEmailTemplates(snapshot.emailTemplates)
      setNotificationRules(snapshot.notificationRules)
      setRateLimitRules(snapshot.rateLimitRules)
      setCurrentVersion(snapshot.currentVersion)
      setOriginalTemplates(
        snapshot.emailTemplates.reduce<Record<string, EmailTemplate>>((acc, template) => {
          acc[template.id] = template
          return acc
        }, {})
      )
      setRateLimitsTouched(false)
      setRateLimitErrors({})
      setHistory(versions)
      if (!activeTemplateId && snapshot.emailTemplates.length > 0) {
        setActiveTemplateId(snapshot.emailTemplates[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger la configuration.')
    } finally {
      setIsLoading(false)
    }
  }, [activeTemplateId])

  useEffect(() => {
    loadSnapshot()
  }, [loadSnapshot])

  const setSnapshot = useCallback((snapshot: ConfigurationSnapshot) => {
    setParameters(snapshot.parameters)
    setFeatureFlags(snapshot.featureFlags)
    setExperiments(snapshot.experiments)
    setEmailTemplates(snapshot.emailTemplates)
    setNotificationRules(snapshot.notificationRules)
    setRateLimitRules(snapshot.rateLimitRules)
    setCurrentVersion(snapshot.currentVersion)
    setOriginalTemplates(snapshot.emailTemplates.reduce<Record<string, EmailTemplate>>((acc, template) => {
      acc[template.id] = template
      return acc
    }, {}))
    setRateLimitErrors({})
  }, [])

  const handleParameterChange = (key: string, value: string) => {
    setParameters(current =>
      current.map(parameter =>
        parameter.key === key
          ? {
              ...parameter,
              value:
                parameter.type === 'number'
                  ? Number(value)
                  : parameter.type === 'boolean'
                  ? value === 'true'
                  : value
            }
          : parameter
      )
    )
  }

  const handleFlagToggle = (key: string, enabled: boolean) => {
    setFeatureFlags(current =>
      current.map(flag => (flag.key === key ? { ...flag, enabled } : flag))
    )
  }

  const handleFlagRolloutChange = (key: string, value: string) => {
    setFeatureFlags(current =>
      current.map(flag =>
        flag.key === key
          ? {
              ...flag,
              rolloutPercentage: value === '' ? undefined : Number(value)
            }
          : flag
      )
    )
  }

  const handleExperimentVariantChange = (
    experimentId: string,
    variantId: string,
    changes: Partial<AbTestVariant>
  ) => {
    setExperiments(current =>
      current.map(experiment =>
        experiment.id === experimentId
          ? {
              ...experiment,
              variants: experiment.variants.map(variant =>
                variant.id === variantId ? { ...variant, ...changes } : variant
              )
            }
          : experiment
      )
    )
  }

  const handleNotificationToggle = (ruleId: string, enabled: boolean) => {
    setNotificationRules(current =>
      current.map(rule => (rule.id === ruleId ? { ...rule, enabled } : rule))
    )
  }

  const handleRateLimitChange = (
    ruleId: string,
    field: keyof Pick<RateLimitRule, 'limit' | 'windowSeconds' | 'burstLimit'>,
    value: string
  ) => {
    setRateLimitRules(current => {
      const updated = current.map(rule =>
        rule.id === ruleId
          ? {
              ...rule,
              [field]: value === '' ? (field === 'burstLimit' ? undefined : 0) : Number(value)
            }
          : rule
      )

      if (rateLimitsTouched) {
        setRateLimitErrors(validateRateLimits(updated))
      }

      return updated
    })
  }

  const validateParameters = useCallback(() => {
    const errors: Record<string, string> = {}

    parameters.forEach(parameter => {
      if (parameter.type === 'number' && Number.isNaN(Number(parameter.value))) {
        errors[`param-${parameter.key}`] = 'Ce paramètre doit être un nombre valide.'
      }
    })

    return errors
  }, [parameters])

  const validateExperiments = useCallback(() => {
    const errors: Record<string, string> = {}

    experiments.forEach(experiment => {
      const total = experiment.variants.reduce(
        (sum, variant) => sum + Number(variant.trafficPercentage || 0),
        0
      )

      if (total !== 100) {
        errors[`experiment-${experiment.id}`] = 'La répartition doit totaliser 100%.'
      }
    })

    return errors
  }, [experiments])

  const validateRateLimits = useCallback(
    (rules: RateLimitRule[] = rateLimitRules) => {
      const errors: Record<string, string> = {}

    rules.forEach(rule => {
      if (!Number.isFinite(rule.limit) || rule.limit <= 0) {
        errors[`rate-${rule.id}`] = 'La limite doit être un nombre positif.'
      }

      if (!Number.isFinite(rule.windowSeconds) || rule.windowSeconds <= 0) {
        errors[`rate-window-${rule.id}`] = "La fenêtre doit être supérieure à zéro."
      }

      if (rule.burstLimit !== undefined && rule.burstLimit < rule.limit) {
        errors[`rate-burst-${rule.id}`] = 'La limite de rafale doit être supérieure à la limite principale.'
      }
    })

    return errors
  }, [rateLimitRules])

  const validateTemplate = useCallback(
    (template: EmailTemplate) => {
      const errors: Record<string, string> = {}

      if (!template.subject.trim()) {
        errors.subject = 'Le sujet est obligatoire.'
      }

      if (!template.htmlContent.trim()) {
        errors.htmlContent = 'Le contenu HTML ne peut pas être vide.'
      }

      if (!template.plainTextContent.trim()) {
        errors.plainTextContent = 'La version texte est obligatoire.'
      }

      return errors
    },
    []
  )

  const handleParameterSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors = validateParameters()
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus(null)
      return
    }

    setSavingSection('parameters')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.updateParameters(parameters)
      setSnapshot(snapshot)
      setStatus('Paramètres enregistrés avec succès.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour les paramètres.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleFeatureFlagSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const errors: Record<string, string> = {}
    featureFlags.forEach(flag => {
      if (
        flag.rolloutPercentage !== undefined &&
        (flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100)
      ) {
        errors[`flag-${flag.key}`] = 'Le pourcentage doit être compris entre 0 et 100.'
      }
    })

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus(null)
      return
    }

    setSavingSection('featureFlags')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.updateFeatureFlags(featureFlags)
      setSnapshot(snapshot)
      setStatus('Feature flags mis à jour.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour les feature flags.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleExperimentSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors = validateExperiments()
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus(null)
      return
    }

    setSavingSection('experiments')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.updateExperiments(experiments)
      setSnapshot(snapshot)
      setStatus('Tests A/B mis à jour.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour les tests A/B.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleNotificationSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingSection('notifications')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.updateNotificationRules(notificationRules)
      setSnapshot(snapshot)
      setStatus('Règles de notification enregistrées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour les notifications.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleRateLimitSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const errors = validateRateLimits()
    setRateLimitsTouched(true)
    setRateLimitErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus(null)
      return
    }

    setRateLimitsTouched(false)
    setRateLimitErrors({})
    setSavingSection('rateLimits')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.updateRateLimits(rateLimitRules)
      setSnapshot(snapshot)
      setStatus('Limites de débit enregistrées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour les limites de débit.')
    } finally {
      setSavingSection(null)
    }
  }

  const activeTemplate = useMemo(
    () => emailTemplates.find(template => template.id === activeTemplateId) || null,
    [activeTemplateId, emailTemplates]
  )

  const templateErrors = useMemo(() => {
    if (!activeTemplate) {
      return {}
    }

    return validateTemplate(activeTemplate)
  }, [activeTemplate, validateTemplate])

  const handleTemplateChange = (changes: Partial<EmailTemplate>) => {
    if (!activeTemplate) {
      return
    }

    setEmailTemplates(current =>
      current.map(template =>
        template.id === activeTemplate.id ? { ...template, ...changes } : template
      )
    )
  }

  const handleTemplateSave = async () => {
    if (!activeTemplate) {
      return
    }

    const errors = validateTemplate(activeTemplate)
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setStatus(null)
      return
    }

    setSavingSection(`template-${activeTemplate.id}`)
    setStatus(null)

    try {
      const updatedTemplate = await ConfigurationService.updateEmailTemplate(activeTemplate)
      setEmailTemplates(current =>
        current.map(template => (template.id === updatedTemplate.id ? updatedTemplate : template))
      )
      setOriginalTemplates(current => ({ ...current, [updatedTemplate.id]: updatedTemplate }))
      setStatus('Template email mis à jour.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de mettre à jour le template.')
    } finally {
      setSavingSection(null)
    }
  }

  const handleTemplatePreview = async () => {
    if (!activeTemplate) {
      return
    }

    try {
      const result = await ConfigurationService.previewEmailTemplate({
        htmlContent: activeTemplate.htmlContent,
        plainTextContent: activeTemplate.plainTextContent
      })
      setPreviewHtml(result.renderedHtml)
      setPreviewPlainText(result.plainText)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer l'aperçu du template.")
    }
  }

  const handleRevert = async (version: string) => {
    setSavingSection('revert')
    setStatus(null)

    try {
      const snapshot = await ConfigurationService.revertToVersion(version)
      setSnapshot(snapshot)
      setStatus(`Configuration restaurée sur la version ${version}.`)
      const versions = await ConfigurationService.getVersionHistory()
      setHistory(versions)
      setRateLimitsTouched(false)
      setRateLimitErrors({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de restaurer la configuration.')
    } finally {
      setSavingSection(null)
    }
  }

  if (isLoading) {
    return (
      <section aria-busy="true" style={{ padding: '48px', textAlign: 'center' }}>
        Chargement de la configuration...
      </section>
    )
  }

  if (error) {
    return (
      <section role="alert" style={{ padding: '48px', textAlign: 'center', color: '#b91c1c' }}>
        {error}
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <header style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ marginBottom: '8px' }}>Configuration de la plateforme</h1>
            <p style={sectionSubtitleStyle}>
              Gérez les paramètres globaux, les expérimentations et les communications.
            </p>
          </div>
          {currentVersion && (
            <div style={{ textAlign: 'right', color: '#4b5563' }}>
              <div style={{ fontWeight: 600 }}>Version actuelle : {currentVersion.version}</div>
              <div>Dernière mise à jour : {formatDate(currentVersion.updatedAt)}</div>
              <div>Par : {currentVersion.updatedBy}</div>
            </div>
          )}
        </div>
        {status && (
          <div
            role="status"
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: '#dcfce7',
              color: '#166534'
            }}
          >
            {status}
          </div>
        )}
      </header>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Paramètres généraux</h2>
            <p style={sectionSubtitleStyle}>
              Définissez les paramètres globaux utilisés par l'ensemble de la plateforme.
            </p>
          </div>
          <button type="button" style={buttonStyle} onClick={handleParameterSubmit} disabled={savingSection === 'parameters'}>
            {savingSection === 'parameters' ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
        <form onSubmit={handleParameterSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={formGridStyle}>
            {parameters.map(parameter => (
              <div key={parameter.key}>
                <label htmlFor={parameter.key} style={labelStyle}>
                  {parameter.label}
                </label>
                {parameter.type === 'boolean' ? (
                  <select
                    id={parameter.key}
                    style={inputStyle}
                    value={parameter.value ? 'true' : 'false'}
                    onChange={event => handleParameterChange(parameter.key, event.target.value)}
                  >
                    <option value="true">Activé</option>
                    <option value="false">Désactivé</option>
                  </select>
                ) : (
                  <input
                    id={parameter.key}
                    style={inputStyle}
                    value={String(parameter.value)}
                    type={parameter.type === 'number' ? 'number' : 'text'}
                    onChange={event => handleParameterChange(parameter.key, event.target.value)}
                  />
                )}
                {parameter.description && (
                  <p style={helperTextStyle}>{parameter.description}</p>
                )}
                {validationErrors[`param-${parameter.key}`] && (
                  <p style={errorTextStyle}>{validationErrors[`param-${parameter.key}`]}</p>
                )}
              </div>
            ))}
          </div>
          <button type="submit" style={buttonStyle} disabled={savingSection === 'parameters'}>
            {savingSection === 'parameters' ? 'Enregistrement...' : 'Enregistrer les paramètres'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Feature flags</h2>
            <p style={sectionSubtitleStyle}>
              Activez ou désactivez les fonctionnalités expérimentales par segment.
            </p>
          </div>
        </div>
        <form onSubmit={handleFeatureFlagSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={formGridStyle}>
            {featureFlags.map(flag => (
              <div key={flag.key} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
                <div style={toggleLabelStyle}>
                  <div>
                    <strong>{flag.label}</strong>
                    {flag.description && <p style={{ ...sectionSubtitleStyle, marginTop: '4px' }}>{flag.description}</p>}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                      {flag.enabled ? 'Activé' : 'Désactivé'}
                    </span>
                    <input
                      type="checkbox"
                      checked={flag.enabled}
                      onChange={event => handleFlagToggle(flag.key, event.target.checked)}
                    />
                  </label>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label htmlFor={`rollout-${flag.key}`} style={labelStyle}>
                    Pourcentage de déploiement
                  </label>
                  <input
                    id={`rollout-${flag.key}`}
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    style={inputStyle}
                    value={flag.rolloutPercentage ?? ''}
                    onChange={event => handleFlagRolloutChange(flag.key, event.target.value)}
                  />
                  {validationErrors[`flag-${flag.key}`] && (
                    <p style={errorTextStyle}>{validationErrors[`flag-${flag.key}`]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="submit" style={buttonStyle} disabled={savingSection === 'featureFlags'}>
            {savingSection === 'featureFlags' ? 'Enregistrement...' : 'Enregistrer les feature flags'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Tests A/B</h2>
            <p style={sectionSubtitleStyle}>
              Configurez et suivez les expérimentations en cours.
            </p>
          </div>
        </div>
        <form onSubmit={handleExperimentSubmit} style={{ display: 'grid', gap: '16px' }}>
          {experiments.map(experiment => (
            <div key={experiment.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{experiment.name}</h3>
                  <p style={sectionSubtitleStyle}>{experiment.hypothesis}</p>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Statut : {experiment.status}</span>
              </div>
              <div style={{ display: 'grid', gap: '12px' }}>
                {experiment.variants.map(variant => (
                  <div key={variant.id} style={{ display: 'grid', gap: '8px', gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <div>
                      <label htmlFor={`${experiment.id}-variant-${variant.id}-label`} style={labelStyle}>
                        Variante
                      </label>
                      <input
                        id={`${experiment.id}-variant-${variant.id}-label`}
                        style={inputStyle}
                        value={variant.label}
                        onChange={event =>
                          handleExperimentVariantChange(experiment.id, variant.id, {
                            label: event.target.value
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`${experiment.id}-variant-${variant.id}-traffic`} style={labelStyle}>
                        Allocation (%)
                      </label>
                      <input
                        id={`${experiment.id}-variant-${variant.id}-traffic`}
                        type="number"
                        min={0}
                        max={100}
                        style={inputStyle}
                        value={variant.trafficPercentage}
                        onChange={event =>
                          handleExperimentVariantChange(experiment.id, variant.id, {
                            trafficPercentage: Number(event.target.value)
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`${experiment.id}-variant-${variant.id}-goal`} style={labelStyle}>
                        Indicateur suivi
                      </label>
                      <input
                        id={`${experiment.id}-variant-${variant.id}-goal`}
                        style={inputStyle}
                        value={variant.goalMetric}
                        onChange={event =>
                          handleExperimentVariantChange(experiment.id, variant.id, {
                            goalMetric: event.target.value
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              {validationErrors[`experiment-${experiment.id}`] && (
                <p style={errorTextStyle}>{validationErrors[`experiment-${experiment.id}`]}</p>
              )}
            </div>
          ))}
          <button type="submit" style={buttonStyle} disabled={savingSection === 'experiments'}>
            {savingSection === 'experiments' ? 'Enregistrement...' : 'Enregistrer les tests A/B'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Templates email</h2>
            <p style={sectionSubtitleStyle}>
              Modifiez les communications transactionnelles et marketing.
            </p>
          </div>
        </div>

        {emailTemplates.length === 0 ? (
          <p style={{ color: '#6b7280' }}>Aucun template disponible.</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '220px 1fr' }}>
            <nav aria-label="Liste des templates" style={{ borderRight: '1px solid #e5e7eb', paddingRight: '16px' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '8px' }}>
                {emailTemplates.map(template => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTemplateId(template.id)
                        setPreviewHtml(null)
                        setPreviewPlainText(null)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        backgroundColor: template.id === activeTemplateId ? '#1f2937' : '#fff',
                        color: template.id === activeTemplateId ? '#fff' : '#111827',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{template.name}</div>
                      <div style={{ fontSize: '0.75rem' }}>Dernière mise à jour : {formatDate(template.lastUpdatedAt)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              {activeTemplate && (
                <TemplateEditor
                  template={activeTemplate}
                  original={originalTemplates[activeTemplate.id]}
                  onChange={handleTemplateChange}
                  onSave={handleTemplateSave}
                  onPreview={handleTemplatePreview}
                  isSaving={savingSection === `template-${activeTemplate.id}`}
                  previewHtml={previewHtml}
                  previewPlainText={previewPlainText}
                  errors={templateErrors}
                />
              )}
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Notifications</h2>
            <p style={sectionSubtitleStyle}>
              Définissez les canaux de notification utilisés pour chaque événement.
            </p>
          </div>
        </div>
        <form onSubmit={handleNotificationSubmit} style={{ display: 'grid', gap: '16px' }}>
          {notificationRules.map(rule => (
            <div key={rule.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'grid', gap: '12px' }}>
              <div style={toggleLabelStyle}>
                <div>
                  <strong>{rule.label}</strong>
                  {rule.description && <p style={{ ...sectionSubtitleStyle, marginTop: '4px' }}>{rule.description}</p>}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                    {rule.enabled ? 'Activé' : 'Désactivé'}
                  </span>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={event => handleNotificationToggle(rule.id, event.target.checked)}
                  />
                </label>
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Canaux : {rule.channel.toUpperCase()}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Déclencheurs : {rule.triggers.join(', ')}
                </span>
              </div>
            </div>
          ))}
          <button type="submit" style={buttonStyle} disabled={savingSection === 'notifications'}>
            {savingSection === 'notifications' ? 'Enregistrement...' : 'Enregistrer les notifications'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Limites de débit</h2>
            <p style={sectionSubtitleStyle}>
              Protégez les API en définissant des limites de requêtes.
            </p>
          </div>
        </div>
        <form onSubmit={handleRateLimitSubmit} style={{ display: 'grid', gap: '16px' }}>
          {rateLimitRules.map(rule => (
            <div key={rule.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
              <h3 style={{ marginTop: 0 }}>{rule.label}</h3>
              {rule.description && <p style={sectionSubtitleStyle}>{rule.description}</p>}
              <div style={formGridStyle}>
                <div>
                  {(() => {
                    const error = rateLimitsTouched ? rateLimitErrors[`rate-${rule.id}`] : undefined
                    return (
                      <>
                  <label htmlFor={`limit-${rule.id}`} style={labelStyle}>
                    Limite maximale
                  </label>
                  <input
                    id={`limit-${rule.id}`}
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={rule.limit}
                    onChange={event => handleRateLimitChange(rule.id, 'limit', event.target.value)}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `rate-error-${rule.id}` : undefined}
                  />
                      {error && (
                        <p id={`rate-error-${rule.id}`} style={errorTextStyle}>
                          {error}
                        </p>
                      )}
                      </>
                    )
                  })()}
                </div>
                <div>
                  {(() => {
                    const error = rateLimitsTouched
                      ? rateLimitErrors[`rate-window-${rule.id}`]
                      : undefined
                    return (
                      <>
                  <label htmlFor={`window-${rule.id}`} style={labelStyle}>
                    Fenêtre (secondes)
                  </label>
                  <input
                    id={`window-${rule.id}`}
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={rule.windowSeconds}
                    onChange={event => handleRateLimitChange(rule.id, 'windowSeconds', event.target.value)}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `rate-window-error-${rule.id}` : undefined}
                  />
                      {error && (
                        <p id={`rate-window-error-${rule.id}`} style={errorTextStyle}>
                          {error}
                        </p>
                      )}
                      </>
                    )
                  })()}
                </div>
                <div>
                  {(() => {
                    const error = rateLimitsTouched
                      ? rateLimitErrors[`rate-burst-${rule.id}`]
                      : undefined
                    return (
                      <>
                  <label htmlFor={`burst-${rule.id}`} style={labelStyle}>
                    Limite de rafale
                  </label>
                  <input
                    id={`burst-${rule.id}`}
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={rule.burstLimit ?? ''}
                    onChange={event => handleRateLimitChange(rule.id, 'burstLimit', event.target.value)}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `rate-burst-error-${rule.id}` : undefined}
                  />
                      {error && (
                        <p id={`rate-burst-error-${rule.id}`} style={errorTextStyle}>
                          {error}
                        </p>
                      )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          ))}
          <button type="submit" style={buttonStyle} disabled={savingSection === 'rateLimits'}>
            {savingSection === 'rateLimits' ? 'Enregistrement...' : 'Enregistrer les limites'}
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <div>
            <h2 style={{ margin: 0 }}>Historique des versions</h2>
            <p style={sectionSubtitleStyle}>
              Consultez les mises à jour et restaurez une version précédente si nécessaire.
            </p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '12px' }}>
          {history.map(version => (
            <div
              key={version.version}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>Version {version.version}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{version.summary}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Mis à jour le {formatDate(version.updatedAt)} par {version.updatedBy}
                </div>
              </div>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => handleRevert(version.version)}
                disabled={savingSection === 'revert'}
              >
                Restaurer
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
