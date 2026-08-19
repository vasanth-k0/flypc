import {
  getApexDescription,
  loadApexCatalog,
  loadApexCatalogEntry,
  readInstalledServiceDefinition,
  removeInstalledMetadataDir,
  type ApexCatalogEntry,
} from '../lib/ApexCatalog.js'
import {
  getAppUsers,
  isUserInstalled,
  loadAppsCatalog,
  removeAppFromCatalog,
  removeUserFromApp,
  saveAppsCatalog,
  type AppCatalogDefinition,
} from './AppsCatalog.js'
import type { ApexInstallOptions, ApexStoreApp } from './apex/types.js'
import { defaultKubeConfig } from './apex/defaultKubeConfig.js'
import { runApexCleanupForUser, runApexInstallPipeline } from './apex/ApexInstallPipeline.js'

const SYSTEM_APP_KEYS = new Set(['apex'])

export const mapStoreApp = (
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
  appType: entry.service.type,
  hasContainerImage:
    (typeof entry.service.image === 'string' && Boolean(entry.service.image))
    || (entry.service.dependencies?.some((dependency) => Boolean(dependency.image)) ?? false),
  installDefaults: {
    runtime: entry.service.runtime ?? 'docker',
    volumes: entry.service.volumes ?? [],
    kube: { ...defaultKubeConfig(), ...entry.service.kube },
  },
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

  async installApp(username: string, appKey: string, options: ApexInstallOptions = {}): Promise<ApexStoreApp> {
    if (SYSTEM_APP_KEYS.has(appKey)) {
      throw new Error(`"${appKey}" is a system app and cannot be installed from Apex`)
    }

    await runApexInstallPipeline(username, appKey, options)
    return this.getStoreApp(appKey, username)
  }

  async uninstallApp(username: string, appKey: string): Promise<ApexStoreApp> {
    if (SYSTEM_APP_KEYS.has(appKey)) {
      throw new Error(`"${appKey}" is a system app and cannot be uninstalled`)
    }

    await runApexCleanupForUser(username, appKey)

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
      await runApexCleanupForUser(username, appKey)
    }

    saveAppsCatalog(removeAppFromCatalog(currentCatalog, appKey))
    removeInstalledMetadataDir(appKey)

    return { ok: true, appKey }
  }
}

export const apexService = new ApexService()

export type { ApexInstallOptions, ApexStoreApp }
