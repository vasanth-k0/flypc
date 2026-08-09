import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getAppsIndexPath } from '../lib/PathResolver.js'
import { loadServiceDefinition } from '../services/ServiceRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localStoreRoot = path.resolve(__dirname, '../db/store')
const localHomeRoot = path.resolve(localStoreRoot, 'homes')
const systemBlueprintPath = path.resolve(localStoreRoot, 'system-blueprint.json')

const defaultBlueprint = {
  name: 'Mr. User',
  colorPalette: 'Grey • Blue',
  ui: 'desktop',
  controlsSide: 'right',
  gotoConsole: true,
  defaultApp: 'coderun-lite',
  wallp: 1,
  containerProgram: 'docker',
}

const isProvisioningEnabled = (): boolean => process.env.ENABLE_SYSTEM_PROVISIONING === 'true'

export const getTenantHomeRoot = (): string => {
  if (isProvisioningEnabled()) {
    return '/home'
  }

  return process.env.TENANT_HOME_ROOT ?? localHomeRoot
}

export const ensureBlueprintFile = (): void => {
  fs.mkdirSync(path.dirname(systemBlueprintPath), { recursive: true })
  if (!fs.existsSync(systemBlueprintPath)) {
    fs.writeFileSync(systemBlueprintPath, JSON.stringify(defaultBlueprint, null, 2), 'utf8')
  }
}

export const readBlueprint = (): Record<string, unknown> => {
  ensureBlueprintFile()
  const raw = fs.readFileSync(systemBlueprintPath, 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

export const writeBlueprint = (payload: Record<string, unknown>): void => {
  ensureBlueprintFile()
  fs.writeFileSync(systemBlueprintPath, JSON.stringify(payload, null, 2), 'utf8')
}

export const getUserHomePath = (username: string): string => path.resolve(getTenantHomeRoot(), username)

export const getUserPreferencesPath = (username: string): string =>
  path.join(getUserHomePath(username), 'preferences.json')

const serverRoot = path.resolve(__dirname, '../..')

const getFlypcDistStorageRoot = (): string => {
  const flypcRoot = path.resolve(serverRoot, '../../../..')
  return path.join(flypcRoot, 'dist/storage/internal')
}

export const getAppStorageRoot = (): string =>
  process.env.APP_STORAGE_ROOT ?? getFlypcDistStorageRoot()

export const getUserAppStoragePath = (username: string, appKey: string): string =>
  path.join(getAppStorageRoot(), 'user', username, appKey)

const defaultAppSubdirs = ['data', 'config', 'workspace'] as const

export const ensureUserAppStorage = (
  username: string,
  appKey: string,
  service?: { mounts?: Array<string | { source: string }> },
): string => {
  const appStoragePath = getUserAppStoragePath(username, appKey)
  fs.mkdirSync(appStoragePath, { recursive: true })

  for (const subdir of defaultAppSubdirs) {
    fs.mkdirSync(path.join(appStoragePath, subdir), { recursive: true })
  }

  for (const entry of service?.mounts ?? []) {
    const relativeSource = typeof entry === 'string' ? entry : entry.source
    if (!path.isAbsolute(relativeSource)) {
      fs.mkdirSync(path.join(appStoragePath, relativeSource), { recursive: true })
    }
  }

  return appStoragePath
}

type AppCatalogEntry = {
  published?: boolean
  users?: string[]
}

export const ensureUserAppsStorageOnLogin = (username: string): void => {
  const appsFile = getAppsIndexPath()
  if (!fs.existsSync(appsFile)) {
    return
  }

  const apps = JSON.parse(fs.readFileSync(appsFile, 'utf8')) as Record<string, AppCatalogEntry>

  for (const [appKey, app] of Object.entries(apps)) {
    if (!app.published || !Array.isArray(app.users) || !app.users.includes(username)) {
      continue
    }

    try {
      const service = loadServiceDefinition(appKey)
      ensureUserAppStorage(username, appKey, service)
    } catch {
      // Ignore apps without service metadata.
    }
  }
}

export const ensureUserPreferencesFromBlueprint = (username: string): void => {
  const homePath = getUserHomePath(username)
  const preferencesPath = getUserPreferencesPath(username)

  fs.mkdirSync(homePath, { recursive: true })
  if (!fs.existsSync(preferencesPath)) {
    fs.writeFileSync(preferencesPath, JSON.stringify(readBlueprint(), null, 2), 'utf8')
  }
}

const appendFstabIfMissing = (entry: string): void => {
  const fstabPath = '/etc/fstab'
  const current = fs.existsSync(fstabPath) ? fs.readFileSync(fstabPath, 'utf8') : ''
  if (!current.includes(entry)) {
    const next = current.endsWith('\n') || current.length === 0 ? `${current}${entry}\n` : `${current}\n${entry}\n`
    fs.writeFileSync(fstabPath, next, 'utf8')
  }
}

export const provisionUserStorage = (username: string): { homePath: string; mode: 'system' | 'local' } => {
  ensureBlueprintFile()

  if (!isProvisioningEnabled()) {
    ensureUserPreferencesFromBlueprint(username)
    return { homePath: getUserHomePath(username), mode: 'local' }
  }

  const imageRoot = '/img'
  const imagePath = path.join(imageRoot, `${username}.img`)
  const homePath = path.join('/home', username)

  fs.mkdirSync(imageRoot, { recursive: true })
  fs.mkdirSync(homePath, { recursive: true })

  if (!fs.existsSync(imagePath)) {
    execFileSync('dd', ['if=/dev/zero', `of=${imagePath}`, 'bs=1M', 'count=100'], { stdio: 'ignore' })
    execFileSync('mkfs.ext4', ['-F', imagePath], { stdio: 'ignore' })
  }

  execFileSync('mount', ['-o', 'loop', imagePath, homePath], { stdio: 'ignore' })

  const fstabEntry = `${imagePath} ${homePath} ext4 loop,defaults 0 0`
  appendFstabIfMissing(fstabEntry)

  ensureUserPreferencesFromBlueprint(username)
  return { homePath, mode: 'system' }
}

export const removeUserStorage = (username: string): void => {
  const homePath = getUserHomePath(username)

  if (!isProvisioningEnabled()) {
    fs.rmSync(homePath, { recursive: true, force: true })
    return
  }

  const imagePath = path.join('/img', `${username}.img`)

  try {
    execFileSync('umount', [homePath], { stdio: 'ignore' })
  } catch {
    // Ignore unmount errors for already-unmounted tenants.
  }

  fs.rmSync(homePath, { recursive: true, force: true })
  fs.rmSync(imagePath, { force: true })
}
