import React from 'react'
import { Button, Input, message } from 'antd'

export type ServiceConfigSection = {
  title: string
  rows: Array<{ label: string; value: string }>
}

type ServiceConfigPanelProps = {
  appKey: string
  sections: ServiceConfigSection[]
  isAdmin: boolean
  editableEnv?: Record<string, string>
  onEnvSaved?: () => void
}

const authHeaders = (): HeadersInit => {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const token = window.localStorage.getItem('flypc-auth-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

export const ServiceConfigPanel: React.FC<ServiceConfigPanelProps> = ({
  appKey,
  sections,
  isAdmin,
  editableEnv,
  onEnvSaved,
}) => {
  const [envDraft, setEnvDraft] = React.useState<Record<string, string>>(editableEnv ?? {})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setEnvDraft(editableEnv ?? {})
  }, [editableEnv])

  const saveEnv = async (): Promise<void> => {
    setSaving(true)
    try {
      const response = await fetch(`/apps/${encodeURIComponent(appKey)}/controls/service-config`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ env: envDraft }),
      })
      if (!response.ok) throw new Error('Save failed')
      message.success('Service configuration updated')
      onEnvSaved?.()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="control-pane__section">
      <h3 className="control-pane__section-title">Service configuration</h3>
      {sections.map((section) => (
        <div key={section.title} className="service-config__section">
          <div className="service-config__section-title">{section.title}</div>
          <dl className="service-config__list">
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.label}`} className="service-config__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      {isAdmin && editableEnv && Object.keys(editableEnv).length > 0 ? (
        <div className="service-config__admin">
          <div className="service-config__section-title">Admin overrides (environment)</div>
          {Object.entries(envDraft).map(([key, value]) => (
            <div key={key} className="service-config__env-row">
              <span className="service-config__env-key">{key}</span>
              <Input
                size="small"
                value={value}
                onChange={(event) =>
                  setEnvDraft((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </div>
          ))}
          <Button size="small" type="primary" loading={saving} onClick={() => void saveEnv()}>
            Save service config
          </Button>
        </div>
      ) : null}
    </div>
  )
}
