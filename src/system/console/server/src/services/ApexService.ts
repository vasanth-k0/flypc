import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import net from 'node:net'
import type { ServiceDefinition } from '../types/ServiceDefinition.js'
import {
  copyCatalogMetadataToApp,
  getApexDescription,
  loadApexCatalog,
  loadApexCatalogEntry,
  readInstalledServiceDefinition,
  removeInstalledMetadataDir,
  removeUserFromInstalledServicePorts,
  writeInstalledServiceDefinition,
  type ApexCatalogEntry,
} from '../lib/ApexCatalog.js'
import { getContainerProgram } from '../lib/SystemSettings.js'
import {
  ensureUserAppStorage,
  getUserAppStoragePath,
} from '../controllers/TenantStorage.js'
import { removeAppContainer, stopApp } from './AppService.js'
import {
  addUserToApp,
  getAppUsers,
  isUserInstalled,
  loadAppsCatalog,
  removeAppFromCatalog,
  removeUserFromApp,
  saveAppsCatalog,
  type AppCatalogDefinition,
} from './AppsCatalog.js'

const execFileAsync = promisify(execFile)

const SYSTEM_APP_KEYS = new Set(['apex'])

const isPortFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })

const findFreeHostPort = async (preferred: number): Promise<number> => {
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

const assignUserPorts = async (
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

const pullContainerImages = async (service: ServiceDefinition): Promise<void> => {
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

const toCatalogDefinition = (entry: ApexCatalogEntry): AppCatalogDefinition => ({
  name: entry.manifest.name,
  icon: entry.manifest.icon,
  published: true,
  users: [],
  ...(entry.manifest.system ? { system: true } : {}),
})

export type ApexStoreApp = {
  key: string
  name: string
  icon: string
  description: string
  about: string
  installed: boolean
  system: boolean
  hasContainerImage: boolean
  dependencies: Array<{
    key: string
    image: string
    ports: Record<string, number>
  }>
  installedUsers: string[]
}

const mapStoreApp = (
  entry: ApexCatalogEntry,
  installedApp: ReturnType<typeof loadAppsCatalog>[string] | undefined,
  username: string,
): ApexStoreApp => ({
  key: entry.key,
  name: entry.manifest.name,
  icon: entry.manifest.icon,
  description: entry.manifest.description ?? getApexDescription(entry.about),
  about: entry.about,
  installed: isUserInstalled(installedApp, username),
  system: Boolean(entry.manifest.system),
  hasContainerImage:
    (typeof entry.service.image === 'string' && Boolean(entry.service.image))
    || (entry.service.dependencies?.some((dependency) => Boolean(dependency.image)) ?? false),
  dependencies: (entry.service.dependencies ?? []).map((dependency) => ({
    key: dependency.key,
    image: dependency.image,
    ports: Object.fromEntries(
      Object.entries(dependency.ports ?? {}).filter(
        ([name, value]) => name !== 'users' && typeof value === 'number',
      ),
    ) as Record<string, number>,
  })),
  installedUsers: installedApp?.users ?? [],
})

export class ApexService {
  listStoreApps(username: string): ApexStoreApp[] {
    const installedCatalog = loadAppsCatalog()

    return loadApexCatalog().map((entry) =>
      mapStoreApp(entry, installedCatalog[entry.key], username),
    )
  }

  getStoreApp(appKey: string, username: string): ApexStoreApp {
    const entry = loadApexCatalogEntry(appKey)
    return mapStoreApp(entry, loadAppsCatalog()[appKey], username)
  }

  async installApp(username: string, appKey: string): Promise<ApexStoreApp> {
    if (SYSTEM_APP_KEYS.has(appKey)) {
      throw new Error(`"${appKey}" is a system app and cannot be installed from Apex`)
    }

    const entry = loadApexCatalogEntry(appKey)
    copyCatalogMetadataToApp(entry)
    await assignUserPorts(appKey, username, entry)
    await pullContainerImages(readInstalledServiceDefinition(appKey) ?? entry.service)

    const installedService = readInstalledServiceDefinition(appKey) ?? entry.service
    ensureUserAppStorage(username, appKey, installedService)

    const nextCatalog = addUserToApp(
      loadAppsCatalog(),
      appKey,
      username,
      toCatalogDefinition(entry),
    )
    saveAppsCatalog(nextCatalog)

    return this.getStoreApp(appKey, username)
  }

  private async cleanupUserInstall(username: string, appKey: string): Promise<void> {
    try {
      await stopApp(username, appKey)
    } catch {
      // Ignore stop failures during uninstall cleanup.
    }

    try {
      await removeAppContainer(username, appKey)
    } catch {
      // Ignore container cleanup failures during uninstall cleanup.
    }

    fs.rmSync(getUserAppStoragePath(username, appKey), { recursive: true, force: true })
    removeUserFromInstalledServicePorts(appKey, username)
  }

  async uninstallApp(username: string, appKey: string): Promise<ApexStoreApp> {
    if (SYSTEM_APP_KEYS.has(appKey)) {
      throw new Error(`"${appKey}" is a system app and cannot be uninstalled`)
    }

    await this.cleanupUserInstall(username, appKey)

    const currentCatalog = loadAppsCatalog()
    const remainingUsers = getAppUsers(currentCatalog, appKey).filter((entry) => entry !== username)
    saveAppsCatalog(removeUserFromApp(currentCatalog, appKey, username))

    if (remainingUsers.length === 0) {
      removeInstalledMetadataDir(appKey)
    }

    return this.getStoreApp(appKey, username)
  }

  async uninstallAppForAllUsers(appKey: string): Promise<{ ok: true; appKey: string }> {
    if (SYSTEM_APP_KEYS.has(appKey)) {
      throw new Error(`"${appKey}" is a system app and cannot be removed`)
    }

    const currentCatalog = loadAppsCatalog()
    const users = getAppUsers(currentCatalog, appKey)

    for (const username of users) {
      await this.cleanupUserInstall(username, appKey)
    }

    saveAppsCatalog(removeAppFromCatalog(currentCatalog, appKey))
    removeInstalledMetadataDir(appKey)

    return { ok: true, appKey }
  }
}

export const apexService = new ApexService()
