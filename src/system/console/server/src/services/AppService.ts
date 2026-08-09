import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getContainerProgram } from '../lib/SystemSettings.js'
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
import { getUserAppStoragePath, ensureUserAppStorage } from '../controllers/TenantStorage.js'
import { Container } from './Container.js'
import { loadServiceDefinition } from './ServiceRegistry.js'
import {
  buildTtyUrl,
  getTtySessionStatus,
  startTtySession,
  stopTtySession,
} from './TtyService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')

const runningContainers = new Map<string, Container>()

const containerKey = (username: string, appKey: string): string => `${username}:${appKey}`

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

const buildAppUrl = (ports: Record<string, number>): string | null => {
  if (typeof ports.tty === 'number') {
    return buildTtyUrl(ports.tty)
  }

  if (typeof ports.http === 'number') {
    return buildTtyUrl(ports.http)
  }

  const values = Object.values(ports)
  if (values.length === 0) {
    return null
  }

  const port = values[0]!
  return buildTtyUrl(port)
}

const isTtyDaemon = (service: ServiceDefinition): boolean =>
  service.type === 'daemon'
  && typeof service.image !== 'string'
  && typeof service.ports?.tty === 'number'

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
    program: getContainerProgram(),
    service,
    volumeMounts: buildVolumeMounts(service, appStoragePath),
    portMappings: mappings,
    runtimePorts: runtime,
  })

  runningContainers.set(key, container)
  return container
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
      url: buildAppUrl(runtime),
      detail: 'Service has no container image; storage prepared only.',
    }
  }

  const container = getOrCreateContainer(username, appKey)
  const containerId = await container.start()
  const status = await container.getStatus()
  const inspect = await container.inspect()

  return {
    ok: true,
    appKey,
    status,
    containerId,
    containerName,
    ports: inspect.ports,
    url: buildAppUrl(inspect.ports),
  }
}

export const stopApp = async (username: string, appKey: string): Promise<AppStartResult> => {
  const service = loadServiceDefinition(appKey)
  const containerName = sanitizeContainerName(username, appKey)

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
    url: buildAppUrl(inspect.ports),
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
  const service = loadServiceDefinition(appKey)

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

export const getAppStoragePath = (username: string, appKey: string): string =>
  getUserAppStoragePath(username, appKey)

export const getServerRoot = (): string => serverRoot
