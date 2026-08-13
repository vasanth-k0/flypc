import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveUserPorts,
  resolveUserTtyPort,
} from '../lib/PortResolver.js'
import type {
  AppRuntimeStatus,
  AppStartResult,
  ContainerVolumeMount,
  ServiceDefinition,
  ServiceMount,
} from '../types/ServiceDefinition.js'
import { getUserAppStoragePath, ensureUserAppStorage } from './storage/TenantStorage.js'
import { Container } from './Container.js'
import { loadServiceDefinition } from './ServiceRegistry.js'
import {
  buildTtyUrl,
  getTtySessionStatus,
  startTtySession,
  stopTtySession,
} from './TtyService.js'
import {
  isKubernetesManaged,
  isOnDemandContainer,
  isTtyDaemon,
  resolveServiceContainerProgram,
} from './AppLifecyclePolicy.js'
import {
  buildKubernetesAppUrl,
  getWorkloadStatus,
  provisionKubernetesWorkload,
  reconcileKubernetesWorkload,
} from './AppControlsService.js'
import {
  buildAppProxyPath,
  registerAppGatewayRouteAndSync,
} from './AppRouteService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')

const runningContainers = new Map<string, Container>()

const containerKey = (username: string, appKey: string): string => `${username}:${appKey}`

const stackManagedDaemon = (appKey: string): { url: string; detail: string } | null => {
  if (appKey === 'konnect' && process.env.KONNECT_URL) {
    return {
      url: `/apps/${appKey}/view/`,
      detail: `Using stack Konnect service at ${process.env.KONNECT_URL}.`,
    }
  }

  if (appKey === 'rhost-kube' && process.env.RHOST_KUBE_URL) {
    return {
      url: `/apps/${appKey}/view/`,
      detail: `Using stack rhost-kube service at ${process.env.RHOST_KUBE_URL}.`,
    }
  }

  return null
}

const sanitizeContainerName = (username: string, appKey: string): string =>
  `${username}-${appKey}`.replace(/[^a-zA-Z0-9_.-]/g, '-').toLowerCase()

const resolveMountSource = (appStoragePath: string, source: string): string => {
  if (path.isAbsolute(source)) {
    return source
  }

  return path.join(appStoragePath, source)
}

const buildVolumeMounts = (
  service: ServiceDefinition,
  appStoragePath: string,
): ContainerVolumeMount[] => {
  const defaultTarget = service.storageMount ?? '/flypc/storage'
  const mounts: ContainerVolumeMount[] = [
    {
      source: appStoragePath,
      target: defaultTarget,
      ...(service.readonly ? { readonly: true } : {}),
    },
  ]

  for (const entry of service.mounts ?? []) {
    const mount = normalizeMount(entry, appStoragePath)
    const duplicate = mounts.some(
      (existing) => existing.source === mount.source && existing.target === mount.target,
    )
    if (!duplicate) {
      mounts.push(mount)
    }
  }

  return mounts
}

const normalizeMount = (entry: ServiceMount, appStoragePath: string): ContainerVolumeMount => {
  if (typeof entry === 'string') {
    return {
      source: resolveMountSource(appStoragePath, entry),
      target: `/flypc/${entry.replace(/^\/+/, '')}`,
    }
  }

  return {
    source: resolveMountSource(appStoragePath, entry.source),
    target: entry.target,
    ...(entry.readonly !== undefined ? { readonly: entry.readonly } : {}),
  }
}

const buildAppUrl = (appKey: string, ports: Record<string, number>): string | null => {
  if (typeof ports.tty === 'number') {
    return buildTtyUrl(ports.tty)
  }

  if (Object.keys(ports).length === 0) {
    return null
  }

  return buildAppProxyPath(appKey)
}

const mapKubePhaseToStatus = (phase: string): AppRuntimeStatus => {
  if (phase === 'Running') {
    return 'running'
  }

  if (phase === 'Pending') {
    return 'stopped'
  }

  return 'stopped'
}

const getOrCreateContainer = (username: string, appKey: string): Container => {
  const key = containerKey(username, appKey)
  const existing = runningContainers.get(key)
  if (existing) {
    return existing
  }

  const service = loadServiceDefinition(appKey)
  const appStoragePath = ensureUserAppStorage(username, appKey, service)
  const { runtime, mappings } = resolveUserPorts(service, username)
  const container = new Container({
    name: sanitizeContainerName(username, appKey),
    program: resolveServiceContainerProgram(service),
    service,
    volumeMounts: buildVolumeMounts(service, appStoragePath),
    portMappings: mappings,
    runtimePorts: runtime,
  })

  runningContainers.set(key, container)
  return container
}

const startKubernetesApp = async (
  username: string,
  appKey: string,
  service: ServiceDefinition,
): Promise<AppStartResult> => {
  const containerName = sanitizeContainerName(username, appKey)
  await reconcileKubernetesWorkload(appKey, username, service)
  const workload = await getWorkloadStatus(appKey, username)
  const { runtime: ports } = resolveUserPorts(service, username)

  return {
    ok: true,
    appKey,
    status: mapKubePhaseToStatus(workload.phase),
    containerName: `k8s-${containerName}`,
    ports,
    url: buildKubernetesAppUrl(service, ports),
    ...(workload.message ? { detail: workload.message } : {}),
  }
}

const startOnDemandContainerApp = async (
  username: string,
  appKey: string,
): Promise<AppStartResult> => {
  const container = getOrCreateContainer(username, appKey)
  const containerId = await container.start({ preserveStopped: true })
  const status = await container.getStatus()
  const inspect = await container.inspect()

  const primaryPort = inspect.ports.http ?? Object.values(inspect.ports)[0]
  if (typeof primaryPort === 'number') {
    registerAppGatewayRouteAndSync(appKey, username, primaryPort)
  }

  return {
    ok: true,
    appKey,
    status,
    containerId,
    containerName: container.name,
    ports: inspect.ports,
    url: buildAppUrl(appKey, inspect.ports),
  }
}

export const startApp = async (username: string, appKey: string): Promise<AppStartResult> => {
  const service = loadServiceDefinition(appKey)
  const containerName = sanitizeContainerName(username, appKey)
  ensureUserAppStorage(username, appKey, service)

  if (service.type === 'run-once') {
    return {
      ok: true,
      appKey,
      status: 'running',
      containerName,
      ports: {},
      url: `/apps/${appKey}/view/`,
    }
  }

  const stackDaemon = stackManagedDaemon(appKey)
  if (stackDaemon) {
    return {
      ok: true,
      appKey,
      status: 'running',
      containerName: `stack-${appKey}`,
      ports: {},
      url: stackDaemon.url,
      detail: stackDaemon.detail,
    }
  }

  if (isTtyDaemon(service)) {
    const ttyPort = resolveUserTtyPort(service, username)
    await startTtySession(username, appKey, ttyPort, service.tty?.command ?? 'bash')

    return {
      ok: true,
      appKey,
      status: 'running',
      containerName,
      ports: { tty: ttyPort },
      url: buildTtyUrl(ttyPort),
    }
  }

  if (isKubernetesManaged(service)) {
    return startKubernetesApp(username, appKey, service)
  }

  if (typeof service.image !== 'string' || !service.image) {
    const runtime = service.ports
      ? resolveUserPorts(service, username).runtime
      : {}

    return {
      ok: true,
      appKey,
      status: 'not-containerized',
      containerName,
      ports: runtime,
      url: buildAppUrl(appKey, runtime),
      detail: 'Service has no container image; storage prepared only.',
    }
  }

  if (isOnDemandContainer(service)) {
    return startOnDemandContainerApp(username, appKey)
  }

  return startOnDemandContainerApp(username, appKey)
}

export const pauseApp = async (username: string, appKey: string): Promise<AppStartResult> => {
  const service = loadServiceDefinition(appKey)
  const containerName = sanitizeContainerName(username, appKey)

  if (service.type === 'run-once' || isKubernetesManaged(service) || stackManagedDaemon(appKey)) {
    return startApp(username, appKey)
  }

  if (isTtyDaemon(service)) {
    return stopApp(username, appKey)
  }

  if (!isOnDemandContainer(service)) {
    const status = await getAppStatus(username, appKey)
    return {
      ok: true,
      appKey,
      status: status.status,
      containerName,
      ports: status.inspect?.ports ?? {},
      url: buildAppUrl(appKey, status.inspect?.ports ?? {}),
    }
  }

  const container = getOrCreateContainer(username, appKey)
  await container.pause()
  const status = await container.getStatus()
  const inspect = await container.inspect()

  return {
    ok: true,
    appKey,
    status,
    containerName: container.name,
    ports: inspect.ports,
    url: buildAppUrl(appKey, inspect.ports),
  }
}

export const stopApp = async (username: string, appKey: string): Promise<AppStartResult> => {
  const service = loadServiceDefinition(appKey)
  const containerName = sanitizeContainerName(username, appKey)

  const stackDaemon = stackManagedDaemon(appKey)
  if (stackDaemon) {
    return {
      ok: true,
      appKey,
      status: 'running',
      containerName: `stack-${appKey}`,
      ports: {},
      url: stackDaemon.url,
      detail: stackDaemon.detail,
    }
  }

  if (isKubernetesManaged(service)) {
    const workload = await getWorkloadStatus(appKey, username)
    const { runtime: ports } = resolveUserPorts(service, username)
    return {
      ok: true,
      appKey,
      status: mapKubePhaseToStatus(workload.phase),
      containerName: `k8s-${containerName}`,
      ports,
      url: buildKubernetesAppUrl(service, ports),
      detail: 'Kubernetes workloads remain running; use control pane or uninstall to remove.',
    }
  }

  if (isTtyDaemon(service)) {
    await stopTtySession(username, appKey)
    const ttyPort = resolveUserTtyPort(service, username)
    const status = await getTtySessionStatus(ttyPort)

    return {
      ok: true,
      appKey,
      status: status === 'running' ? 'running' : 'stopped',
      containerName,
      ports: { tty: ttyPort },
      url: buildTtyUrl(ttyPort),
    }
  }

  const key = containerKey(username, appKey)
  const container = runningContainers.get(key) ?? getOrCreateContainer(username, appKey)
  await container.stop()

  const status = await container.getStatus()
  const inspect = await container.inspect()

  return {
    ok: true,
    appKey,
    status,
    containerName: container.name,
    ports: inspect.ports,
    url: buildAppUrl(appKey, inspect.ports),
  }
}

export const removeAppContainer = async (username: string, appKey: string): Promise<void> => {
  const service = loadServiceDefinition(appKey)

  if (isTtyDaemon(service)) {
    await stopTtySession(username, appKey)
    return
  }

  const key = containerKey(username, appKey)
  const container = runningContainers.get(key) ?? getOrCreateContainer(username, appKey)
  await container.remove()
  runningContainers.delete(key)
}

export const getAppStatus = async (
  username: string,
  appKey: string,
): Promise<{ status: AppRuntimeStatus; inspect?: Awaited<ReturnType<Container['inspect']>> }> => {
  const stackDaemon = stackManagedDaemon(appKey)
  if (stackDaemon) {
    return { status: 'running' }
  }

  const service = loadServiceDefinition(appKey)

  if (isKubernetesManaged(service)) {
    const workload = await getWorkloadStatus(appKey, username)
    return { status: mapKubePhaseToStatus(workload.phase) }
  }

  if (isTtyDaemon(service)) {
    const ttyPort = resolveUserTtyPort(service, username)
    const status = await getTtySessionStatus(ttyPort)
    return { status: status === 'running' ? 'running' : 'stopped' }
  }

  if (typeof service.image !== 'string' || !service.image) {
    return { status: 'not-containerized' }
  }

  const container = getOrCreateContainer(username, appKey)
  const status = await container.getStatus()
  if (status === 'missing') {
    return { status }
  }

  const inspect = await container.inspect()
  return { status, inspect }
}

export const getDockerRuntimeStatus = async (
  username: string,
  appKey: string,
): Promise<{
  containerName: string
  status: AppRuntimeStatus
  ports: Record<string, number>
  proxyPath: string | null
}> => {
  const service = loadServiceDefinition(appKey)
  const containerName = sanitizeContainerName(username, appKey)
  const { runtime } = resolveUserPorts(service, username)

  if (typeof service.image !== 'string' || !service.image) {
    return {
      containerName,
      status: 'not-containerized',
      ports: runtime,
      proxyPath: null,
    }
  }

  const container = getOrCreateContainer(username, appKey)
  const status = await container.getStatus()
  const inspect = status === 'missing' ? undefined : await container.inspect()

  return {
    containerName: container.name,
    status,
    ports: inspect?.ports ?? runtime,
    proxyPath: Object.keys(runtime).length > 0 ? buildAppProxyPath(appKey) : null,
  }
}

export const getAppStoragePath = (username: string, appKey: string): string =>
  getUserAppStoragePath(username, appKey)

export const getServerRoot = (): string => serverRoot
