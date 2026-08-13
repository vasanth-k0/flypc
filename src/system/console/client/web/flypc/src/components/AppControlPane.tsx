import React from 'react'
import {
  Button,
  Input,
  InputNumber,
  Select,
  Tabs,
  Tag,
  message,
} from 'antd'
import {
  CloudServerOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import './control-pane.css'
import { ServiceConfigPanel, type ServiceConfigSection } from './ServiceConfigPanel'
import { useAppSelector } from '../store/hooks'

type AppVolume = {
  name: string
  type: 'persistent' | 'emptyDir' | 'hostPath'
  mountPath: string
  size?: string
  storageClass?: string
}

type KubeConfig = {
  replicas?: number
  placement?: { tier?: 'entry' | 'worker' | 'any'; subdomains?: string[] }
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
  strategy?: 'RollingUpdate' | 'Recreate'
}

type ServiceDefinition = {
  type: 'run-once' | 'daemon'
  runtime?: 'docker' | 'kubernetes'
  image?: string | false
  env?: Record<string, string>
  volumes?: AppVolume[]
  kube?: KubeConfig
}

type ControlMeta = {
  enabled: boolean
  appType: 'run-once' | 'daemon'
  runtime: 'docker' | 'kubernetes'
  hasKubeConfig: boolean
  managementMode: 'kubernetes' | 'session-container' | 'static'
  lifecycleCategory?: string
  lifecycleLabel?: string
}

type DockerRuntimeStatus = {
  containerName: string
  status: string
  ports: Record<string, number>
  proxyPath: string | null
}

type WorkloadStatus = {
  phase: string
  replicas: number
  readyReplicas: number
  message?: string
  pods: Array<{ name: string; phase: string; node?: string; restarts: number }>
  pvcs: Array<{ name: string; status: string; capacity?: string }>
}

type ClusterNode = {
  nodeId: string
  meshIp: string
  tier: 'entry' | 'worker'
  publicHost: string
  ready: boolean
}

type AppControlPaneProps = {
  appKey: string
  appName: string
}

const authHeaders = (): HeadersInit => {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const token = window.localStorage.getItem('flypc-auth-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

const statusClass = (phase: string): string => {
  if (phase === 'Running') return 'control-pane__status-pill control-pane__status-pill--running'
  if (phase === 'Failed') return 'control-pane__status-pill control-pane__status-pill--failed'
  return 'control-pane__status-pill control-pane__status-pill--pending'
}

export const AppControlPane: React.FC<AppControlPaneProps> = ({ appKey, appName }) => {
  const authUser = useAppSelector((state) => state.auth.user)
  const isAdmin = authUser?.role === 'Admin'
  const [meta, setMeta] = React.useState<ControlMeta | null>(null)
  const [service, setService] = React.useState<ServiceDefinition | null>(null)
  const [serviceSections, setServiceSections] = React.useState<ServiceConfigSection[]>([])
  const [status, setStatus] = React.useState<WorkloadStatus | null>(null)
  const [dockerStatus, setDockerStatus] = React.useState<DockerRuntimeStatus | null>(null)
  const [nodes, setNodes] = React.useState<ClusterNode[]>([])
  const [about, setAbout] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [rolling, setRolling] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    setLoading(true)
    try {
      const [metaRes, configRes, statusRes, nodesRes, aboutRes, serviceConfigRes] = await Promise.all([
        fetch(`/apps/${encodeURIComponent(appKey)}/controls/meta`, { headers: authHeaders() }),
        fetch(`/apps/${encodeURIComponent(appKey)}/controls/config`, { headers: authHeaders() }),
        fetch(`/apps/${encodeURIComponent(appKey)}/controls/status`, { headers: authHeaders() }),
        fetch(`/apps/${encodeURIComponent(appKey)}/controls/nodes`, { headers: authHeaders() }),
        fetch(`/apps/${encodeURIComponent(appKey)}/about`, { headers: authHeaders() }),
        fetch(`/apps/${encodeURIComponent(appKey)}/controls/service-config`, { headers: authHeaders() }),
      ])

      if (metaRes.ok) setMeta((await metaRes.json()) as ControlMeta)
      if (configRes.ok) {
        const payload = (await configRes.json()) as { service: ServiceDefinition }
        setService(payload.service)
      }
      if (serviceConfigRes.ok) {
        const payload = (await serviceConfigRes.json()) as { sections: ServiceConfigSection[]; service: ServiceDefinition }
        setServiceSections(payload.sections)
        setService(payload.service)
      }
      if (statusRes.ok) {
        const payload = (await statusRes.json()) as {
          mode: 'kubernetes' | 'session-container' | 'static'
          status: WorkloadStatus | DockerRuntimeStatus | null
        }
        if (payload.mode === 'kubernetes' && payload.status) {
          setStatus(payload.status as WorkloadStatus)
          setDockerStatus(null)
        } else if (payload.mode === 'session-container' && payload.status) {
          setDockerStatus(payload.status as DockerRuntimeStatus)
          setStatus(null)
        }
      }
      if (nodesRes.ok) {
        const payload = (await nodesRes.json()) as { nodes: ClusterNode[] }
        setNodes(payload.nodes ?? [])
      }
      if (aboutRes.ok) setAbout(await aboutRes.text())
    } catch {
      message.error('Failed to load control pane')
    } finally {
      setLoading(false)
    }
  }, [appKey])

  React.useEffect(() => {
    void loadAll()
  }, [loadAll])

  const saveConfig = async (): Promise<void> => {
    if (!service) return
    setSaving(true)
    try {
      const response = await fetch(`/apps/${encodeURIComponent(appKey)}/controls/config`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          runtime: service.runtime,
          volumes: service.volumes,
          kube: service.kube,
        }),
      })
      if (!response.ok) throw new Error('Save failed')
      const payload = (await response.json()) as { service: ServiceDefinition }
      setService(payload.service)
      message.success('Configuration saved and reconciled')
      void loadAll()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const triggerRollout = async (): Promise<void> => {
    setRolling(true)
    try {
      const response = await fetch(`/apps/${encodeURIComponent(appKey)}/controls/rollout`, {
        method: 'POST',
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error('Rollout failed')
      setStatus(await response.json() as WorkloadStatus)
      message.success('Rollout triggered')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Rollout failed')
    } finally {
      setRolling(false)
    }
  }

  const aboutBlock = (
    <section className="control-pane__markdown">
      {about.split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {line.startsWith('# ') ? <h2>{line.slice(2)}</h2> : line ? <p>{line}</p> : <br />}
        </React.Fragment>
      ))}
    </section>
  )

  if (loading) {
    return <div className="control-pane__empty">Loading {appName} controls…</div>
  }

  if (!meta?.enabled) {
    return (
      <div className="control-pane">
        {aboutBlock}
        {serviceSections.length > 0 ? (
          <div className="control-pane__body">
            <ServiceConfigPanel
              appKey={appKey}
              sections={serviceSections}
              isAdmin={isAdmin}
              editableEnv={service?.env}
              onEnvSaved={() => void loadAll()}
            />
          </div>
        ) : null}
      </div>
    )
  }

  const updateVolume = (index: number, patch: Partial<AppVolume>): void => {
    if (!service) return
    const volumes = [...(service.volumes ?? [])]
    volumes[index] = { ...volumes[index], ...patch }
    setService({ ...service, volumes })
  }

  const addVolume = (): void => {
    if (!service) return
    setService({
      ...service,
      volumes: [
        ...(service.volumes ?? []),
        { name: `vol-${(service.volumes?.length ?? 0) + 1}`, type: 'persistent', mountPath: '/data', size: '10Gi', storageClass: 'longhorn' },
      ],
    })
  }

  const isKubernetes = meta.managementMode === 'kubernetes'
  const isSessionContainer = meta.managementMode === 'session-container'

  const formatContainerState = (state?: string): string => {
    if (!state) return 'unknown'
    if (state === 'paused') return 'paused (window closed)'
    return state
  }

  const containerStateClass = (state?: string): string => {
    if (state === 'running') return statusClass('Running')
    if (state === 'paused') return 'control-pane__status-pill control-pane__status-pill--pending'
    return statusClass('Pending')
  }

  return (
    <div className="control-pane">
      <header className="control-pane__header">
        <div className="control-pane__eyebrow">Application Control Pane</div>
        <h2 className="control-pane__title">{appName}</h2>
        <p className="control-pane__subtitle">
          {meta.lifecycleLabel ? (
            <span className="control-pane__lifecycle-tag">{meta.lifecycleLabel}</span>
          ) : null}
          {isKubernetes
            ? 'Manage runtime, volumes, placement, and cluster rollout for this service.'
            : isSessionContainer
              ? 'Session container — starts when you open the app and pauses when you close the window.'
              : 'View service configuration and container status.'}
        </p>
      </header>

      {about ? aboutBlock : null}

      <div className="control-pane__tabs">
        <Tabs
          defaultActiveKey="overview"
          items={[
            {
              key: 'overview',
              label: <span><DeploymentUnitOutlined /> Overview</span>,
              children: (
                <div className="control-pane__body">
                  {serviceSections.length > 0 ? (
                    <ServiceConfigPanel
                      appKey={appKey}
                      sections={serviceSections}
                      isAdmin={isAdmin}
                      editableEnv={service?.env}
                      onEnvSaved={() => void loadAll()}
                    />
                  ) : null}

                  {isKubernetes ? (
                    <>
                      <div className="control-pane__section">
                        <h3 className="control-pane__section-title">Runtime Status</h3>
                        <div className="control-pane__metric-grid">
                          <div className="control-pane__metric">
                            <span className="control-pane__metric-label">Phase</span>
                            <span className={statusClass(status?.phase ?? 'Unknown')}>{status?.phase ?? 'Unknown'}</span>
                          </div>
                          <div className="control-pane__metric">
                            <span className="control-pane__metric-label">Ready</span>
                            <span className="control-pane__metric-value">{status?.readyReplicas ?? 0}/{status?.replicas ?? 0}</span>
                          </div>
                          <div className="control-pane__metric">
                            <span className="control-pane__metric-label">Runtime</span>
                            <span className="control-pane__metric-value">kubernetes</span>
                          </div>
                        </div>
                        {status?.message && <p className="control-pane__subtitle" style={{ marginTop: '0.75rem' }}>{status.message}</p>}
                      </div>

                      <div className="control-pane__section">
                        <h3 className="control-pane__section-title">Pods</h3>
                        {(status?.pods ?? []).length === 0 ? (
                          <div className="control-pane__empty">No pods deployed yet.</div>
                        ) : (
                          status?.pods.map((pod) => (
                            <div key={pod.name} className="control-pane__volume-row">
                              <strong style={{ fontSize: '0.76rem' }}>{pod.name}</strong>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {pod.phase} · {pod.node ?? 'unscheduled'} · restarts {pod.restarts}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : isSessionContainer ? (
                    <div className="control-pane__section">
                      <h3 className="control-pane__section-title">Session container</h3>
                      <div className="control-pane__metric-grid">
                        <div className="control-pane__metric">
                          <span className="control-pane__metric-label">Container</span>
                          <span className="control-pane__metric-value">{dockerStatus?.containerName ?? '—'}</span>
                        </div>
                        <div className="control-pane__metric">
                          <span className="control-pane__metric-label">State</span>
                          <span className={containerStateClass(dockerStatus?.status)}>
                            {formatContainerState(dockerStatus?.status)}
                          </span>
                        </div>
                        <div className="control-pane__metric">
                          <span className="control-pane__metric-label">Lifecycle</span>
                          <span className="control-pane__metric-value">pause on close</span>
                        </div>
                        <div className="control-pane__metric">
                          <span className="control-pane__metric-label">Proxy path</span>
                          <span className="control-pane__metric-value">{dockerStatus?.proxyPath ?? '—'}</span>
                        </div>
                      </div>
                      {dockerStatus?.ports && Object.keys(dockerStatus.ports).length > 0 ? (
                        <dl className="service-config__list" style={{ marginTop: '0.75rem' }}>
                          {Object.entries(dockerStatus.ports).map(([name, port]) => (
                            <div key={name} className="service-config__row">
                              <dt>{name}</dt>
                              <dd>{port}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ),
            },
            ...(isKubernetes
              ? [
                  {
                    key: 'runtime',
                    label: <span><SettingOutlined /> Runtime</span>,
                    children: (
                      <div className="control-pane__body">
                        <div className="control-pane__section">
                          <h3 className="control-pane__section-title">Execution</h3>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Runtime</label>
                            <Select
                              value={service?.runtime ?? 'docker'}
                              onChange={(runtime) => service && setService({ ...service, runtime })}
                              options={[
                                { value: 'docker', label: 'Docker (local socket)' },
                                { value: 'kubernetes', label: 'Kubernetes (rhost-kube)' },
                              ]}
                            />
                            <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Replicas</label>
                            <InputNumber
                              min={1}
                              max={12}
                              value={service?.kube?.replicas ?? 1}
                              onChange={(value) =>
                                service &&
                                setService({
                                  ...service,
                                  kube: { ...service.kube, replicas: Number(value ?? 1) },
                                })
                              }
                              style={{ width: '100%' }}
                            />
                            <label style={{ fontSize: '0.72rem', color: '#64748b' }}>Update strategy</label>
                            <Select
                              value={service?.kube?.strategy ?? 'RollingUpdate'}
                              onChange={(strategy) =>
                                service &&
                                setService({
                                  ...service,
                                  kube: { ...service.kube, strategy },
                                })
                              }
                              options={[
                                { value: 'RollingUpdate', label: 'Rolling update' },
                                { value: 'Recreate', label: 'Recreate' },
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'volumes',
                    label: <span><DatabaseOutlined /> Volumes</span>,
                    children: (
                      <div className="control-pane__body">
                        <div className="control-pane__section">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3 className="control-pane__section-title" style={{ margin: 0 }}>Persistent volumes</h3>
                            <Button size="small" onClick={addVolume}>Add</Button>
                          </div>
                          {(service?.volumes ?? []).length === 0 ? (
                            <div className="control-pane__empty">No volumes configured.</div>
                          ) : (
                            service?.volumes?.map((volume, index) => (
                              <div key={`${volume.name}-${index}`} className="control-pane__volume-row">
                                <Input
                                  size="small"
                                  value={volume.name}
                                  placeholder="Name"
                                  onChange={(event) => updateVolume(index, { name: event.target.value })}
                                />
                                <Input
                                  size="small"
                                  value={volume.mountPath}
                                  placeholder="Mount path"
                                  onChange={(event) => updateVolume(index, { mountPath: event.target.value })}
                                />
                                <Input
                                  size="small"
                                  value={volume.size ?? '10Gi'}
                                  placeholder="Size"
                                  onChange={(event) => updateVolume(index, { size: event.target.value })}
                                />
                                <Select
                                  size="small"
                                  value={volume.storageClass ?? 'longhorn'}
                                  onChange={(storageClass) => updateVolume(index, { storageClass })}
                                  options={[{ value: 'longhorn', label: 'Longhorn' }]}
                                />
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'placement',
                    label: <span><CloudServerOutlined /> Placement</span>,
                    children: (
                      <div className="control-pane__body">
                        <div className="control-pane__section">
                          <h3 className="control-pane__section-title">Node tier</h3>
                          <Select
                            value={service?.kube?.placement?.tier ?? 'any'}
                            onChange={(tier) =>
                              service &&
                              setService({
                                ...service,
                                kube: { ...service.kube, placement: { ...service.kube?.placement, tier } },
                              })
                            }
                            style={{ width: '100%' }}
                            options={[
                              { value: 'any', label: 'Any node' },
                              { value: 'entry', label: 'Entry tier only (Ingress eligible)' },
                              { value: 'worker', label: 'Worker tier only' },
                            ]}
                          />
                        </div>

                        <div className="control-pane__section">
                          <h3 className="control-pane__section-title">Cluster nodes</h3>
                          {nodes.length === 0 ? (
                            <div className="control-pane__empty">No Konnect nodes registered yet.</div>
                          ) : (
                            nodes.map((node) => (
                              <div key={node.nodeId} className="control-pane__volume-row">
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  <strong style={{ fontSize: '0.76rem' }}>{node.publicHost || node.nodeId}</strong>
                                  <Tag color={node.tier === 'entry' ? 'blue' : 'default'}>{node.tier}</Tag>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{node.meshIp} · {node.ready ? 'ready' : 'offline'}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {isKubernetes ? (
        <footer className="control-pane__footer">
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            <Button
              className="control-pane__save-btn"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => void saveConfig()}
            >
              Save & Apply
            </Button>
            <Button icon={<ReloadOutlined />} loading={rolling} onClick={() => void triggerRollout()}>
              Restart rollout
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
