import React, { useEffect, useState } from 'react'
import { Alert, Button, Input, Select, Space, Tag, Typography, message } from 'antd'

const { Text, Paragraph } = Typography

export type RHostDomainState = {
  brandOwner: string
  productName: string
  baseDomain: string
  accountSlug: string
  nodeRole: 'hub' | 'primary' | 'branch' | 'standalone'
  nodeId: string
  publicHost: string
  adminEmail: string
  sslMode: 'internal' | 'letsencrypt' | 'manual'
  sslStatus: 'pending' | 'active' | 'error'
  sslMessage: string
  httpsEnabled: boolean
  initialSetupComplete: boolean
  caddyfilePath?: string
  httpsUrl?: string
}

type DomainManagerProps = {
  isAdmin: boolean
  authToken: string
  primaryColor: string
  onSetupComplete?: () => void
}

const buildAuthHeaders = (authToken: string): Headers => {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' })
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return headers
}

export const DomainManager: React.FC<DomainManagerProps> = ({
  isAdmin,
  authToken,
  primaryColor,
  onSetupComplete,
}) => {
  const [domain, setDomain] = useState<RHostDomainState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadDomain = async (): Promise<void> => {
    setLoading(true)
    try {
      const response = await fetch('/system/domain', { headers: buildAuthHeaders(authToken) })
      const payload = (await response.json()) as { ok: boolean; domain: RHostDomainState; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load domain settings')
      }
      setDomain(payload.domain)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to load domain settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDomain()
  }, [authToken])

  const saveDomain = async (extra?: Partial<RHostDomainState> & { completeInitialSetup?: boolean }): Promise<void> => {
    if (!domain || !isAdmin) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/system/domain', {
        method: 'PUT',
        headers: buildAuthHeaders(authToken),
        body: JSON.stringify({ ...domain, ...extra }),
      })
      const payload = (await response.json()) as { ok: boolean; domain: RHostDomainState; error?: string; detail?: string }
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.error ?? 'Unable to save domain settings')
      }
      setDomain(payload.domain)
      message.success(extra?.completeInitialSetup ? 'Initial setup complete — desktop mode enabled' : 'Domain settings saved')
      if (extra?.completeInitialSetup) {
        onSetupComplete?.()
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to save domain settings')
    } finally {
      setSaving(false)
    }
  }

  const applySsl = async (): Promise<void> => {
    if (!isAdmin) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/system/domain/apply-ssl', {
        method: 'POST',
        headers: buildAuthHeaders(authToken),
        body: JSON.stringify({}),
      })
      const payload = (await response.json()) as { ok: boolean; domain: RHostDomainState; message?: string; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to apply SSL profile')
      }
      setDomain(payload.domain)
      message.success(payload.message ?? 'SSL profile regenerated')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Unable to apply SSL profile')
    } finally {
      setSaving(false)
    }
  }

  if (!domain) {
    return <Text type="secondary">{loading ? 'Loading domain settings…' : 'Domain settings unavailable'}</Text>
  }

  const sslColor = domain.sslStatus === 'active' ? 'success' : domain.sslStatus === 'error' ? 'error' : 'warning'

  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {!domain.initialSetupComplete ? (
        <Alert
          type="info"
          showIcon
          message="Initial RHost setup"
          description="Register your domain, configure HTTPS, and enable desktop mode for this node. Brand owner defaults to FlyPC."
          action={
            isAdmin ? (
              <Button type="primary" loading={saving} onClick={() => void saveDomain({ completeInitialSetup: true })}>
                Complete setup
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Brand owner
          <Input
            value={domain.brandOwner}
            disabled={!isAdmin}
            onChange={(event) => setDomain({ ...domain, brandOwner: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Base domain
          <Input
            value={domain.baseDomain}
            disabled={!isAdmin}
            placeholder="localhost or flypc.in"
            onChange={(event) => setDomain({ ...domain, baseDomain: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Account slug
          <Input
            value={domain.accountSlug}
            disabled={!isAdmin}
            placeholder="vk"
            onChange={(event) => setDomain({ ...domain, accountSlug: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Node role
          <Select
            disabled={!isAdmin}
            value={domain.nodeRole}
            options={[
              { value: 'standalone', label: 'Standalone' },
              { value: 'hub', label: 'Hub (www)' },
              { value: 'primary', label: 'Primary node' },
              { value: 'branch', label: 'Branch node' },
            ]}
            onChange={(value) => setDomain({ ...domain, nodeRole: value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Branch node ID
          <Input
            value={domain.nodeId}
            disabled={!isAdmin || domain.nodeRole !== 'branch'}
            placeholder="1"
            onChange={(event) => setDomain({ ...domain, nodeId: event.target.value })}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.78rem' }}>
          Admin email (Let&apos;s Encrypt)
          <Input
            value={domain.adminEmail}
            disabled={!isAdmin}
            onChange={(event) => setDomain({ ...domain, adminEmail: event.target.value })}
          />
        </label>
      </div>

      <div style={{ padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <Space wrap>
          <Text strong>Public host:</Text>
          <Text code>{domain.publicHost}</Text>
          <Tag color={sslColor}>{domain.sslStatus}</Tag>
          <Tag color={domain.sslMode === 'letsencrypt' ? 'blue' : 'default'}>{domain.sslMode}</Tag>
        </Space>
        <Paragraph style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
          {domain.sslMessage}
        </Paragraph>
        {domain.httpsUrl ? (
          <Paragraph style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
            Access URL: <Text style={{ color: primaryColor }}>{domain.httpsUrl}</Text>
          </Paragraph>
        ) : null}
        {domain.caddyfilePath ? (
          <Paragraph style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
            Caddy profile: {domain.caddyfilePath}
          </Paragraph>
        ) : null}
      </div>

      {isAdmin ? (
        <Space wrap>
          <Button type="primary" loading={saving} onClick={() => void saveDomain()}>
            Save domain
          </Button>
          <Button loading={saving} onClick={() => void applySsl()}>
            Regenerate SSL profile
          </Button>
          <Select
            style={{ minWidth: 180 }}
            value={domain.sslMode}
            options={[
              { value: 'internal', label: 'Local HTTPS (internal CA)' },
              { value: 'letsencrypt', label: "Let's Encrypt" },
              { value: 'manual', label: 'Manual TLS' },
            ]}
            onChange={(value) => setDomain({ ...domain, sslMode: value })}
          />
        </Space>
      ) : (
        <Alert type="warning" showIcon message="Admin sign-in required to change domain and SSL settings." />
      )}
    </div>
  )
}
