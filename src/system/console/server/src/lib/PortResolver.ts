import fs from 'node:fs'
import type { ServiceDefinition, ServicePortMap } from '../types/ServiceDefinition.js'
import { getAppsIndexPath } from './PathResolver.js'
import { loadServiceDefinition } from '../services/ServiceRegistry.js'

export type ResolvedPortMapping = {
  name: string
  hostPort: number
  containerPort: number
}

export type ResolvedUserPorts = {
  runtime: Record<string, number>
  mappings: ResolvedPortMapping[]
}

type AppCatalogEntry = {
  published?: boolean
  users?: string[]
}

const isUsersPortMap = (value: unknown): value is Record<string, number> =>
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every((entry) => typeof entry === 'number')

export const getServicePortMap = (service: ServiceDefinition): ServicePortMap =>
  (service.ports ?? {}) as ServicePortMap

export const getConfiguredUserPorts = (service: ServiceDefinition): Record<string, number> => {
  const portMap = getServicePortMap(service)
  const users = portMap.users
  return isUsersPortMap(users) ? users : {}
}

export const getAllowedAppUsers = (appKey: string): string[] => {
  const appsFile = getAppsIndexPath()
  if (!fs.existsSync(appsFile)) {
    return []
  }

  const apps = JSON.parse(fs.readFileSync(appsFile, 'utf8')) as Record<string, AppCatalogEntry>
  const app = apps[appKey]
  if (!app?.published || !Array.isArray(app.users)) {
    return []
  }

  return app.users
}

export const resolveUserHostPort = (
  service: ServiceDefinition,
  username: string,
  portName: string,
): number => {
  const portMap = getServicePortMap(service)
  const userPorts = getConfiguredUserPorts(service)
  const configured = userPorts[username]
  if (typeof configured === 'number') {
    return configured
  }

  const fallback = portMap[portName]
  if (typeof fallback === 'number') {
    return fallback
  }

  throw new Error(`No host port configured for user "${username}" on "${portName}"`)
}

export const resolveUserPorts = (
  service: ServiceDefinition,
  username: string,
): ResolvedUserPorts => {
  const portMap = getServicePortMap(service)
  const runtime: Record<string, number> = {}
  const mappings: ResolvedPortMapping[] = []

  for (const [name, value] of Object.entries(portMap)) {
    if (name === 'users' || typeof value !== 'number') {
      continue
    }

    const hostPort = resolveUserHostPort(service, username, name)
    runtime[name] = hostPort
    mappings.push({
      name,
      hostPort,
      containerPort: value,
    })
  }

  return { runtime, mappings }
}

export const resolveUserTtyPort = (service: ServiceDefinition, username: string): number =>
  resolveUserHostPort(service, username, 'tty')

export const ensureServiceUserPorts = (appKey: string): ServiceDefinition => {
  const service = loadServiceDefinition(appKey)
  const allowedUsers = getAllowedAppUsers(appKey)
  if (allowedUsers.length === 0) {
    return service
  }

  const portMap = { ...getServicePortMap(service) }
  const userPorts = { ...getConfiguredUserPorts(service) }

  for (const username of allowedUsers) {
    if (typeof userPorts[username] === 'number') {
      continue
    }

    for (const [name, value] of Object.entries(portMap)) {
      if (name === 'users' || typeof value !== 'number') {
        continue
      }

      userPorts[username] = value
      break
    }
  }

  return {
    ...service,
    ports: {
      ...portMap,
      users: userPorts,
    },
  }
}
