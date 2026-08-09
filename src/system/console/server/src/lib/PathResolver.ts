import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.resolve(__dirname, '../..')

const hasMonorepoApps = (candidate: string): boolean =>
  fs.existsSync(path.join(candidate, 'src/apps/coderun-lite/view/index.html'))

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

export const getAppMetadataRoot = (): string =>
  process.env.APP_METADATA_ROOT
    ? path.resolve(process.env.APP_METADATA_ROOT)
    : path.resolve(serverRoot, 'app')

export const getAppsIndexPath = (): string => path.join(getAppMetadataRoot(), 'apps.json')

export const resolveAppRuntimeRoot = (runtimeDir: string): string =>
  path.isAbsolute(runtimeDir) ? runtimeDir : path.resolve(getFlypcRoot(), runtimeDir)

export const getAppMetadataPath = (appKey: string, fileName: string): string =>
  path.join(getAppMetadataRoot(), appKey, fileName)

export const getAppViewRoot = (runtimeDir: string): string =>
  path.join(resolveAppRuntimeRoot(runtimeDir), 'view')

export const getHelpersRoot = (): string => path.resolve(__dirname, '../helpers')
