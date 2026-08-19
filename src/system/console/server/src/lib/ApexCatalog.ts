import fs from 'node:fs'
import path from 'node:path'
import { getAppMetadataRoot, getFlypcRoot } from './PathResolver.js'
import type { ServiceDefinition } from '../types/ServiceDefinition.js'

export type ApexManifest = {
  name: string
  icon: string
  description?: string
  system?: boolean
  portDefaults?: Record<string, number>
}

export type ApexCatalogEntry = {
  key: string
  manifest: ApexManifest
  service: ServiceDefinition
  about: string
  catalogPath: string
}

const catalogRoot = (): string => path.join(getFlypcRoot(), 'src/apps/apex/catalog')

export const getApexCatalogRoot = (): string => catalogRoot()

export const listApexCatalogKeys = (): string[] => {
  const root = catalogRoot()
  if (!fs.existsSync(root)) {
    return []
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

const readJsonFile = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, 'utf8')) as T

export const loadApexCatalogEntry = (appKey: string): ApexCatalogEntry => {
  const appDir = path.join(catalogRoot(), appKey)
  const manifestPath = path.join(appDir, 'manifest.json')
  const servicePath = path.join(appDir, 'service.json')
  const aboutPath = path.join(appDir, 'about.md')

  if (!fs.existsSync(manifestPath) || !fs.existsSync(servicePath) || !fs.existsSync(aboutPath)) {
    throw new Error(`Apex catalog entry "${appKey}" is incomplete`)
  }

  return {
    key: appKey,
    manifest: readJsonFile<ApexManifest>(manifestPath),
    service: readJsonFile<ServiceDefinition>(servicePath),
    about: fs.readFileSync(aboutPath, 'utf8'),
    catalogPath: appDir,
  }
}

export const loadApexCatalog = (): ApexCatalogEntry[] =>
  listApexCatalogKeys().map((appKey) => loadApexCatalogEntry(appKey))

export const getApexDescription = (about: string): string => {
  const line = about
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && !entry.startsWith('#') && !entry.startsWith('-'))

  return line ?? 'No description available.'
}

export const getInstalledMetadataDir = (appKey: string): string =>
  path.join(getAppMetadataRoot(), appKey)

export const copyCatalogMetadataToApp = (entry: ApexCatalogEntry): void => {
  const targetDir = getInstalledMetadataDir(entry.key)
  fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(path.join(entry.catalogPath, 'service.json'), path.join(targetDir, 'service.json'))
  fs.copyFileSync(path.join(entry.catalogPath, 'about.md'), path.join(targetDir, 'about.md'))
}

export const removeInstalledMetadataDir = (appKey: string): void => {
  const targetDir = getInstalledMetadataDir(appKey)
  fs.rmSync(targetDir, { recursive: true, force: true })
}

export const readInstalledServiceDefinition = (appKey: string): ServiceDefinition | null => {
  const servicePath = path.join(getInstalledMetadataDir(appKey), 'service.json')
  if (!fs.existsSync(servicePath)) {
    return null
  }

  return readJsonFile<ServiceDefinition>(servicePath)
}

export const writeInstalledServiceDefinition = (appKey: string, service: ServiceDefinition): void => {
  const servicePath = path.join(getInstalledMetadataDir(appKey), 'service.json')
  fs.mkdirSync(path.dirname(servicePath), { recursive: true })
  fs.writeFileSync(servicePath, `${JSON.stringify(service, null, 4)}\n`, 'utf8')
}

export const removeUserFromInstalledServicePorts = (appKey: string, username: string): void => {
  const service = readInstalledServiceDefinition(appKey)
  if (!service?.ports?.users) {
    return
  }

  const users = { ...service.ports.users }
  delete users[username]
  service.ports.users = users
  writeInstalledServiceDefinition(appKey, service)
}
