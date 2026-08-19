import type { AppRuntime, AppVolume, KubeConfig, ServiceDefinition } from '../types/ServiceDefinition.js'
import {
  readInstalledServiceDefinition,
  writeInstalledServiceDefinition,
} from '../lib/ApexCatalog.js'
import {
  getLifecycleCategoryLabel,
  isKubernetesManaged,
  isStaticViewApp,
  isSessionContainer,
  resolveAppManagementMode,
} from './AppLifecyclePolicy.js'
import { buildServiceConfigSections } from '../lib/serviceConfigView.js'

export type ControlPaneMeta = {
  enabled: boolean
  appType: ServiceDefinition['type']
  runtime: AppRuntime
  hasKubeConfig: boolean
  managementMode: 'kubernetes' | 'session-container' | 'static'
  lifecycleCategory: ReturnType<typeof resolveAppManagementMode>
  lifecycleLabel: string
}

export type ControlPaneConfig = {
  appKey: string
  service: ServiceDefinition
}

export type ClusterNodeOption = {
  nodeId: string
  meshIp: string
  tier: 'entry' | 'worker'
  publicHost: string
  ready: boolean
}

export type WorkloadControlStatus = {
  phase: string
  replicas: number
  readyReplicas: number
  message?: string
  pods: Array<{ name: string; phase: string; node?: string; restarts: number }>
  pvcs: Array<{ name: string; status: string; capacity?: string }>
  lastReconciledAt?: string
}

const getKubeBaseUrl = (): string =>
  (process.env.RHOST_KUBE_URL ?? 'http://localhost:3090').replace(/\/$/, '')

const defaultKubeConfig = (): KubeConfig => ({
  replicas: 1,
  placement: { tier: 'any' },
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
  ingress: { enabled: false, path: '/' },
  strategy: 'RollingUpdate',
})

export const getControlPaneMeta = (appKey: string): ControlPaneMeta => {
  const service = readInstalledServiceDefinition(appKey)
  if (!service) {
    return {
      enabled: false,
      appType: 'run-once',
      runtime: 'docker',
      hasKubeConfig: false,
      managementMode: 'static',
      lifecycleCategory: 'run-once',
      lifecycleLabel: getLifecycleCategoryLabel('run-once'),
    }
  }

  const lifecycleCategory = resolveAppManagementMode(service, false)
  const managementMode = isStaticViewApp(service)
    ? 'static'
    : isKubernetesManaged(service)
      ? 'kubernetes'
      : isSessionContainer(service)
        ? 'session-container'
        : 'static'

  return {
    enabled: service.type === 'daemon',
    appType: service.type,
    runtime: isKubernetesManaged(service) ? 'kubernetes' : service.runtime ?? 'docker',
    hasKubeConfig: Boolean(service.kube || service.volumes?.length),
    managementMode,
    lifecycleCategory,
    lifecycleLabel: getLifecycleCategoryLabel(lifecycleCategory),
  }
}

export const getControlPaneConfig = (appKey: string): ControlPaneConfig => {
  const service = readInstalledServiceDefinition(appKey)
  if (!service) {
    throw new Error(`Installed service definition not found for "${appKey}"`)
  }

  return {
    appKey,
    service: {
      ...service,
      runtime: service.runtime ?? 'docker',
      kube: { ...defaultKubeConfig(), ...service.kube },
      volumes: service.volumes ?? [],
    },
  }
}

export const updateControlPaneConfig = async (
  appKey: string,
  username: string,
  patch: {
    runtime?: AppRuntime
    volumes?: AppVolume[]
    kube?: KubeConfig
  },
): Promise<ControlPaneConfig> => {
  const current = getControlPaneConfig(appKey)
  const nextService: ServiceDefinition = {
    ...current.service,
    runtime: patch.runtime ?? current.service.runtime ?? 'docker',
    volumes: patch.volumes ?? current.service.volumes ?? [],
    kube: {
      ...defaultKubeConfig(),
      ...current.service.kube,
      ...patch.kube,
      placement: {
        ...defaultKubeConfig().placement,
        ...current.service.kube?.placement,
        ...patch.kube?.placement,
      },
      resources: {
        ...defaultKubeConfig().resources,
        ...current.service.kube?.resources,
        ...patch.kube?.resources,
      },
      ingress: {
        ...defaultKubeConfig().ingress,
        ...current.service.kube?.ingress,
        ...patch.kube?.ingress,
      },
    },
  }

  writeInstalledServiceDefinition(appKey, nextService)

  if (isKubernetesManaged(nextService) || nextService.runtime === 'kubernetes') {
    await reconcileWithKube(appKey, username, {
      ...nextService,
      runtime: 'kubernetes',
    })
  }

  return { appKey, service: nextService }
}

const reconcileWithKube = async (appKey: string, username: string, service: ServiceDefinition): Promise<void> => {
  const response = await fetch(`${getKubeBaseUrl()}/api/v1/workloads/${encodeURIComponent(appKey)}/reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildWorkloadPayload(appKey, username, service)),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Failed to reconcile workload with rhost-kube')
  }
}

export const getClusterNodes = async (): Promise<ClusterNodeOption[]> => {
  const response = await fetch(`${getKubeBaseUrl()}/api/v1/cluster/nodes`)
  if (!response.ok) {
    return []
  }

  const payload = (await response.json()) as { nodes?: ClusterNodeOption[] }
  return payload.nodes ?? []
}

export const getWorkloadStatus = async (appKey: string, username: string): Promise<WorkloadControlStatus> => {
  const response = await fetch(
    `${getKubeBaseUrl()}/api/v1/workloads/${encodeURIComponent(appKey)}/status?username=${encodeURIComponent(username)}`,
  )

  if (!response.ok) {
    return {
      phase: 'Unknown',
      replicas: 0,
      readyReplicas: 0,
      message: 'Cluster status unavailable',
      pods: [],
      pvcs: [],
    }
  }

  const payload = (await response.json()) as { status: WorkloadControlStatus }
  return payload.status
}

export const rolloutWorkload = async (appKey: string, username: string): Promise<WorkloadControlStatus> => {
  const response = await fetch(`${getKubeBaseUrl()}/api/v1/workloads/${encodeURIComponent(appKey)}/rollout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Rollout failed')
  }

  const payload = (await response.json()) as { status: WorkloadControlStatus }
  return payload.status
}

const buildWorkloadPayload = (appKey: string, username: string, service: ServiceDefinition) => ({
  appKey,
  username,
  namespace: `rhost-${username}`,
  runtime: 'kubernetes' as const,
  image: typeof service.image === 'string' ? service.image : '',
  ports: Object.fromEntries(
    Object.entries(service.ports ?? {}).filter(([key]) => key !== 'users') as Array<[string, number]>,
  ),
  env: service.env ?? {},
  volumes: service.volumes ?? [],
  kube: service.kube,
})

export const buildKubernetesAppUrl = (
  service: ServiceDefinition,
  ports: Record<string, number>,
): string | null => {
  const ingress = service.kube?.ingress
  if (ingress?.enabled && ingress.host) {
    const pathSuffix = ingress.path && ingress.path !== '/' ? ingress.path : ''
    return `https://${ingress.host}${pathSuffix}`
  }

  if (typeof ports.http === 'number') {
    return `http://localhost:${ports.http}/`
  }

  const values = Object.values(ports)
  if (values.length === 0) {
    return null
  }

  return `http://localhost:${values[0]}/`
}

export const reconcileKubernetesWorkload = async (
  appKey: string,
  username: string,
  service: ServiceDefinition,
): Promise<void> => {
  await reconcileWithKube(appKey, username, {
    ...service,
    runtime: 'kubernetes',
  })
}

export const provisionKubernetesWorkload = async (
  appKey: string,
  username: string,
  service: ServiceDefinition,
): Promise<void> => {
  if (isKubernetesManaged(service) || service.runtime === 'kubernetes') {
    await reconcileWithKube(appKey, username, {
      ...service,
      runtime: 'kubernetes',
    })
  }
}

export const getServiceConfigView = (appKey: string, username: string) => {
  const config = getControlPaneConfig(appKey)
  return {
    appKey,
    sections: buildServiceConfigSections(config.service, username),
    service: config.service,
  }
}

export const getInstallContext = async (): Promise<{ nodes: ClusterNodeOption[] }> => ({
  nodes: await getClusterNodes(),
})

export const updateServiceConfigAdmin = async (
  appKey: string,
  patch: Partial<ServiceDefinition>,
): Promise<ControlPaneConfig> => {
  const current = getControlPaneConfig(appKey)
  const nextService: ServiceDefinition = {
    ...current.service,
    ...patch,
  }
  writeInstalledServiceDefinition(appKey, nextService)
  return { appKey, service: nextService }
}
