import fs from 'node:fs'
import type { ApexInstallOptions } from './types.js'
import type { ServiceDefinition } from '../../types/ServiceDefinition.js'
import {
  copyCatalogMetadataToApp,
  loadApexCatalogEntry,
  readInstalledServiceDefinition,
  writeInstalledServiceDefinition,
  type ApexCatalogEntry,
} from '../../lib/ApexCatalog.js'
import {
  addUserToApp,
  loadAppsCatalog,
  saveAppsCatalog,
  type AppCatalogDefinition,
} from '../AppsCatalog.js'
import { ensureUserAppStorage } from '../storage/TenantStorage.js'
import { provisionKubernetesWorkload } from '../AppControlsService.js'
import { assignUserPorts, pullContainerImages } from './PortAssignmentService.js'
import { defaultKubeConfig } from './defaultKubeConfig.js'

const toCatalogDefinition = (entry: ApexCatalogEntry): AppCatalogDefinition => ({
  name: entry.manifest.name,
  icon: entry.manifest.icon,
  published: true,
  users: [],
  ...(entry.manifest.system ? { system: true } : {}),
})

const prepareInstalledService = (
  entry: ApexCatalogEntry,
  options: ApexInstallOptions,
): ServiceDefinition => {
  const installedService = structuredClone(readInstalledServiceDefinition(entry.key) ?? entry.service)
  installedService.runtime = options.runtime ?? installedService.runtime ?? entry.service.runtime ?? 'docker'
  installedService.volumes = options.volumes ?? installedService.volumes ?? entry.service.volumes ?? []
  installedService.kube = {
    ...defaultKubeConfig(),
    ...entry.service.kube,
    ...installedService.kube,
    ...options.kube,
    placement: {
      ...defaultKubeConfig().placement,
      ...entry.service.kube?.placement,
      ...installedService.kube?.placement,
      ...options.kube?.placement,
    },
  }
  writeInstalledServiceDefinition(entry.key, installedService)
  return installedService
}

export const runApexInstallPipeline = async (
  username: string,
  appKey: string,
  options: ApexInstallOptions,
): Promise<void> => {
  const entry = loadApexCatalogEntry(appKey)
  copyCatalogMetadataToApp(entry)

  const installedService = prepareInstalledService(entry, options)

  await assignUserPorts(appKey, username, entry)
  await pullContainerImages(readInstalledServiceDefinition(appKey) ?? entry.service)

  ensureUserAppStorage(username, appKey, installedService)

  const nextCatalog = addUserToApp(
    loadAppsCatalog(),
    appKey,
    username,
    toCatalogDefinition(entry),
  )
  saveAppsCatalog(nextCatalog)

  await provisionKubernetesWorkload(appKey, username, installedService)
}

export const runApexCleanupForUser = async (username: string, appKey: string): Promise<void> => {
  const { stopApp, removeAppContainer } = await import('../AppService.js')
  const { getUserAppStoragePath } = await import('../storage/TenantStorage.js')
  const { removeUserFromInstalledServicePorts } = await import('../../lib/ApexCatalog.js')

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
