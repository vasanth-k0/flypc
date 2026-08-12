import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')

const CODERUN_LITE_MARKERS = [
  'src/apps/coderun-lite/view/index.html',
  'apps/coderun-lite/view/index.html',
] as const

const hasMonorepoApps = (candidate: string): boolean =>
  CODERUN_LITE_MARKERS.some((marker) => fs.existsSync(path.join(candidate, marker)))

const readPackageName = (candidate: string): string | null => {
  const packagePath = path.join(candidate, 'package.json')
  if (!fs.existsSync(packagePath)) {
    return null
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { name?: string }
    return typeof pkg.name === 'string' ? pkg.name : null
  } catch {
    return null
  }
}

const findFlypcRoot = (startDir: string): string | null => {
  let current = path.resolve(startDir)

  while (true) {
    if (readPackageName(current) === 'flypc-monorepo' && hasMonorepoApps(current)) {
      return current
    }

    if (hasMonorepoApps(current)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

export const getFlypcRoot = (): string => {
  if (process.env.FLYPC_ROOT) {
    const configuredRoot = path.resolve(process.env.FLYPC_ROOT)
    if (hasMonorepoApps(configuredRoot)) {
      return configuredRoot
    }
  }

  const discoveredRoot =
    findFlypcRoot(serverRoot)
    ?? findFlypcRoot(process.cwd())

  if (discoveredRoot) {
    return discoveredRoot
  }

  throw new Error('Unable to locate flypc monorepo root (expected src/apps/coderun-lite)')
}

export const resolveFromFlypcRoot = (relativePath: string): string => {
  const root = getFlypcRoot()
  const normalized = relativePath.replace(/\\/g, '/')
  const candidates = [path.resolve(root, normalized)]

  if (normalized.startsWith('src/')) {
    candidates.push(path.resolve(root, normalized.slice(4)))
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0]!
}

export const getAppMetadataRoot = (): string =>
  process.env.APP_METADATA_ROOT
    ? path.resolve(process.env.APP_METADATA_ROOT)
    : path.resolve(serverRoot, 'app')

export const getAppsIndexPath = (): string => {
  const metadataRoot = getAppMetadataRoot()
  const candidates = [
    path.join(metadataRoot, 'apps.json'),
    path.join(path.dirname(metadataRoot), 'apps.json'),
    path.join(metadataRoot, 'app', 'apps.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0]!
}

export const resolveAppRuntimeRoot = (runtimeDir: string): string =>
  path.isAbsolute(runtimeDir) ? runtimeDir : resolveFromFlypcRoot(runtimeDir)

export const getAppMetadataPath = (appKey: string, fileName: string): string =>
  path.join(getAppMetadataRoot(), appKey, fileName)

export const getAppViewRoot = (runtimeDir: string): string =>
  path.join(resolveAppRuntimeRoot(runtimeDir), 'view')

export const getHelpersRoot = (): string => path.resolve(__dirname, '../helpers')

export const getBlueprintStoreRoot = (): string => {
  if (process.env.FLYPC_STORE_ROOT) {
    return path.resolve(process.env.FLYPC_STORE_ROOT)
  }

  if (process.env.RHOST_DATA_ROOT) {
    return path.join(path.resolve(process.env.RHOST_DATA_ROOT), 'store')
  }

  return path.join(getFlypcRoot(), 'data/rhost/store')
}
