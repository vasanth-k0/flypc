import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import net from 'node:net'
import type { ServiceDefinition } from '../../types/ServiceDefinition.js'
import { getContainerProgram } from '../../lib/SystemSettings.js'
import {
  readInstalledServiceDefinition,
  writeInstalledServiceDefinition,
  type ApexCatalogEntry,
} from '../../lib/ApexCatalog.js'

const execFileAsync = promisify(execFile)

const isPortFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })

export const findFreeHostPort = async (preferred: number): Promise<number> => {
  if (await isPortFree(preferred)) {
    return preferred
  }

  for (let offset = 1; offset <= 200; offset += 1) {
    const candidate = preferred + offset
    if (await isPortFree(candidate)) {
      return candidate
    }
  }

  throw new Error(`Unable to find a free port near ${preferred}`)
}

export const assignUserPorts = async (
  appKey: string,
  username: string,
  entry: ApexCatalogEntry,
): Promise<void> => {
  const service = readInstalledServiceDefinition(appKey) ?? structuredClone(entry.service)
  if (!service.ports) {
    writeInstalledServiceDefinition(appKey, service)
    return
  }

  const userPorts = { ...(service.ports.users ?? {}) }
  if (typeof userPorts[username] !== 'number') {
    const preferred =
      entry.manifest.portDefaults?.[username]
      ?? Object.entries(service.ports).find(([key, value]) => key !== 'users' && typeof value === 'number')?.[1]

    if (typeof preferred === 'number') {
      userPorts[username] = await findFreeHostPort(preferred)
    }
  }

  service.ports = {
    ...service.ports,
    users: userPorts,
  }
  writeInstalledServiceDefinition(appKey, service)
}

export const pullContainerImages = async (service: ServiceDefinition): Promise<void> => {
  if (process.env.APEX_SKIP_IMAGE_PULL === 'true') {
    return
  }

  const program = getContainerProgram()
  const images = new Set<string>()

  if (typeof service.image === 'string' && service.image) {
    images.add(service.image)
  }

  for (const dependency of service.dependencies ?? []) {
    if (dependency.image) {
      images.add(dependency.image)
    }
  }

  for (const image of images) {
    await execFileAsync(program, ['pull', image])
  }
}
