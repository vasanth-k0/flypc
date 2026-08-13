import http from 'node:http'
import net from 'node:net'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ServiceDefinition } from '../types/ServiceDefinition.js'
import { resolveUserPorts } from '../lib/PortResolver.js'
import { loadServiceDefinition } from './ServiceRegistry.js'
import { getAppStatus } from './AppService.js'
import { isKubernetesManaged, isStaticViewApp, resolveServiceContainerProgram } from './AppLifecyclePolicy.js'
import { resolveAppUpstreamHost } from '../lib/AppUpstream.js'
import { getContainerProgram } from '../lib/SystemSettings.js'

const execFileAsync = promisify(execFile)

export type BootStepId = 'image' | 'container' | 'port' | 'http'

export type BootStepState = 'pending' | 'active' | 'done' | 'failed'

export type BootStep = {
  id: BootStepId
  label: string
  state: BootStepState
  detail?: string
}

export type BootStatus = {
  appKey: string
  requiresChecklist: boolean
  ready: boolean
  failed: boolean
  steps: BootStep[]
  proxyUrl: string | null
  pollIntervalMs: number
  timeoutMs: number
}

const DEFAULT_STEPS: Array<{ id: BootStepId; label: string }> = [
  { id: 'image', label: 'App env available' },
  { id: 'container', label: 'App env started' },
  { id: 'port', label: 'App is up' },
  { id: 'http', label: 'Connecting now' },
]

export const isPortServingApp = (service: ServiceDefinition): boolean =>
  service.type === 'daemon' && typeof service.image === 'string' && Boolean(service.image)

export const getBootPollConfig = (service: ServiceDefinition): { pollIntervalMs: number; timeoutMs: number } => {
  if (isKubernetesManaged(service) || service.autorun === true) {
    return { pollIntervalMs: 2000, timeoutMs: 180_000 }
  }

  return { pollIntervalMs: 3000, timeoutMs: 300_000 }
}

const probeTcp = (host: string, port: number, timeoutMs = 2500): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)

    socket.on('connect', () => {
      clearTimeout(timer)
      socket.end()
      resolve(true)
    })

    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })

const probeHttp = (host: string, port: number, timeoutMs = 4000): Promise<{ ok: boolean; detail?: string }> =>
  new Promise((resolve) => {
    const request = http.get(
      {
        host,
        port,
        path: '/',
        timeout: timeoutMs,
      },
      (response) => {
        const ok = (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 500
        response.resume()
        if (ok) {
          resolve({ ok: true })
          return
        }
        resolve({ ok: false, detail: `HTTP ${response.statusCode ?? 'unknown'}` })
      },
    )

    request.on('timeout', () => {
      request.destroy()
      resolve({ ok: false, detail: 'HTTP probe timed out' })
    })

    request.on('error', (error) => {
      resolve({ ok: false, detail: error.message })
    })
  })

const checkImageAvailable = async (service: ServiceDefinition): Promise<{ ok: boolean; detail?: string }> => {
  if (typeof service.image !== 'string' || !service.image) {
    return { ok: false, detail: 'No container image configured' }
  }

  const program = resolveServiceContainerProgram(service) ?? getContainerProgram()

  try {
    await execFileAsync(program, ['image', 'inspect', service.image], { encoding: 'utf8' })
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

const resolvePrimaryPort = (service: ServiceDefinition, username: string): number | null => {
  const { runtime } = resolveUserPorts(service, username)
  if (typeof runtime.http === 'number') {
    return runtime.http
  }

  const values = Object.values(runtime)
  return values.length > 0 ? values[0]! : null
}

export const getBootStatus = async (username: string, appKey: string): Promise<BootStatus> => {
  const service = loadServiceDefinition(appKey)
  const poll = getBootPollConfig(service)
  const proxyUrl = isPortServingApp(service) ? `/apps/${appKey}/proxy/` : null

  if (isStaticViewApp(service) || !isPortServingApp(service)) {
    return {
      appKey,
      requiresChecklist: false,
      ready: true,
      failed: false,
      steps: [],
      proxyUrl: service.type === 'run-once' ? `/apps/${appKey}/view/` : proxyUrl,
      pollIntervalMs: poll.pollIntervalMs,
      timeoutMs: poll.timeoutMs,
    }
  }

  const steps: BootStep[] = DEFAULT_STEPS.map((step, index) => ({
    ...step,
    state: index === 0 ? 'active' : 'pending',
  }))

  const port = resolvePrimaryPort(service, username)
  if (!port) {
    steps[0]!.state = 'failed'
    steps[0]!.detail = 'No host port assigned for this user'
    return {
      appKey,
      requiresChecklist: true,
      ready: false,
      failed: true,
      steps,
      proxyUrl,
      ...poll,
    }
  }

  const imageCheck = await checkImageAvailable(service)
  if (!imageCheck.ok) {
    steps[0]!.state = 'failed'
    if (imageCheck.detail) {
      steps[0]!.detail = imageCheck.detail
    }
    return {
      appKey,
      requiresChecklist: true,
      ready: false,
      failed: true,
      steps,
      proxyUrl,
      ...poll,
    }
  }

  steps[0]!.state = 'done'
  steps[1]!.state = 'active'

  const containerStatus = await getAppStatus(username, appKey)
  if (containerStatus.status === 'missing' || containerStatus.status === 'stopped') {
    steps[1]!.state = 'failed'
    steps[1]!.detail =
      containerStatus.status === 'missing'
        ? 'Container has not been created yet'
        : 'Container is stopped'
    return {
      appKey,
      requiresChecklist: true,
      ready: false,
      failed: true,
      steps,
      proxyUrl,
      ...poll,
    }
  }

  steps[1]!.state = 'done'
  if (containerStatus.status === 'paused') {
    steps[1]!.detail = 'Paused — resuming'
  }
  steps[2]!.state = 'active'

  const upstreamHost = resolveAppUpstreamHost()
  const tcpOk = await probeTcp(upstreamHost, port)
  if (!tcpOk) {
    return {
      appKey,
      requiresChecklist: true,
      ready: false,
      failed: false,
      steps,
      proxyUrl,
      ...poll,
    }
  }

  steps[2]!.state = 'done'
  steps[3]!.state = 'active'

  const httpCheck = await probeHttp(upstreamHost, port)
  if (!httpCheck.ok) {
    return {
      appKey,
      requiresChecklist: true,
      ready: false,
      failed: false,
      steps,
      proxyUrl,
      ...poll,
    }
  }

  steps[3]!.state = 'done'

  return {
    appKey,
    requiresChecklist: true,
    ready: true,
    failed: false,
    steps,
    proxyUrl,
    ...poll,
  }
}
