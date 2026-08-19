import fs from 'node:fs'
import path from 'node:path'
import { getUserAppStoragePath, getUserHomePath, ensureUserAppStorage } from './storage/TenantStorage.js'
import { loadAppsCatalog } from './AppsCatalog.js'
import { loadServiceDefinition } from './ServiceRegistry.js'

export type FileRootDescriptor = {
  id: string
  label: string
  kind: 'local' | 'home' | 'app'
  appKey?: string
  accessible?: boolean
  locked?: boolean
}

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modifiedAt: string
}

const normalizeRelativePath = (relativePath: string): string => {
  const cleaned = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const segments = cleaned.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '..')) {
    throw new Error('Invalid path')
  }
  return segments.join('/')
}

const assertWithinRoot = (rootPath: string, targetPath: string): void => {
  const resolvedRoot = path.resolve(rootPath)
  const resolvedTarget = path.resolve(targetPath)
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Path escapes root')
  }
}

export const getPublicFileRoots = (authenticated: boolean): FileRootDescriptor[] => [
  { id: 'local', label: 'This PC', kind: 'local', accessible: true },
  {
    id: 'home',
    label: 'FlyDrive',
    kind: 'home',
    accessible: authenticated,
    locked: !authenticated,
  },
]

export const getFileRoots = (username: string): FileRootDescriptor[] => {
  const roots: FileRootDescriptor[] = [
    { id: 'local', label: 'This PC', kind: 'local', accessible: true },
    { id: 'home', label: 'FlyDrive', kind: 'home', accessible: true },
  ]
  const catalog = loadAppsCatalog()

  for (const [appKey, app] of Object.entries(catalog)) {
    if (app.published && app.users.includes(username)) {
      roots.push({
        id: `app:${appKey}`,
        label: app.name,
        kind: 'app',
        appKey,
        accessible: true,
      })
    }
  }

  return roots
}

export const getRootAbsolutePath = (username: string, rootId: string): string => {
  if (rootId === 'local') {
    throw new Error('Local storage is managed on the client device')
  }

  if (rootId === 'home') {
    const homePath = getUserHomePath(username)
    fs.mkdirSync(homePath, { recursive: true })
    return homePath
  }

  if (rootId.startsWith('app:')) {
    const appKey = rootId.slice(4)
    const catalog = loadAppsCatalog()
    const app = catalog[appKey]
    if (!app?.published || !app.users.includes(username)) {
      throw new Error('Access denied to app storage')
    }

    try {
      const service = loadServiceDefinition(appKey)
      ensureUserAppStorage(username, appKey, service)
    } catch {
      ensureUserAppStorage(username, appKey)
    }

    return getUserAppStoragePath(username, appKey)
  }

  throw new Error('Invalid storage root')
}

export const resolveAbsolutePath = (
  username: string,
  rootId: string,
  relativePath = '',
): string => {
  const rootPath = getRootAbsolutePath(username, rootId)
  const normalized = normalizeRelativePath(relativePath)
  const absolutePath = normalized ? path.join(rootPath, normalized) : rootPath
  assertWithinRoot(rootPath, absolutePath)
  return absolutePath
}

const toFileEntry = (rootPath: string, absolutePath: string): FileEntry => {
  const stats = fs.statSync(absolutePath)
  const relative = path.relative(rootPath, absolutePath).split(path.sep).join('/')

  return {
    name: path.basename(absolutePath),
    path: relative,
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  }
}

export const listFiles = (
  username: string,
  rootId: string,
  relativePath = '',
): FileEntry[] => {
  const rootPath = getRootAbsolutePath(username, rootId)
  const directoryPath = resolveAbsolutePath(username, rootId, relativePath)

  if (!fs.existsSync(directoryPath)) {
    throw new Error('Path not found')
  }

  if (!fs.statSync(directoryPath).isDirectory()) {
    throw new Error('Path is not a directory')
  }

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .map((entry) => toFileEntry(rootPath, path.join(directoryPath, entry.name)))
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'directory' ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
}

export const createDirectory = (
  username: string,
  rootId: string,
  relativePath: string,
  name: string,
): FileEntry => {
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    throw new Error('Invalid folder name')
  }

  const parentPath = resolveAbsolutePath(username, rootId, relativePath)
  const nextPath = path.join(parentPath, name)
  assertWithinRoot(getRootAbsolutePath(username, rootId), nextPath)
  fs.mkdirSync(nextPath, { recursive: false })

  return toFileEntry(getRootAbsolutePath(username, rootId), nextPath)
}

export const writeFile = (
  username: string,
  rootId: string,
  relativePath: string,
  fileName: string,
  content: Buffer,
): FileEntry => {
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error('Invalid file name')
  }

  const parentPath = resolveAbsolutePath(username, rootId, relativePath)
  if (!fs.existsSync(parentPath) || !fs.statSync(parentPath).isDirectory()) {
    throw new Error('Upload destination not found')
  }

  const targetPath = path.join(parentPath, fileName)
  assertWithinRoot(getRootAbsolutePath(username, rootId), targetPath)
  fs.writeFileSync(targetPath, content)

  return toFileEntry(getRootAbsolutePath(username, rootId), targetPath)
}

export const deletePaths = (
  username: string,
  rootId: string,
  relativePaths: string[],
): void => {
  for (const relativePath of relativePaths) {
    const absolutePath = resolveAbsolutePath(username, rootId, relativePath)
    fs.rmSync(absolutePath, { recursive: true, force: true })
  }
}

export const movePaths = (
  username: string,
  rootId: string,
  sources: string[],
  destinationDirectory: string,
): FileEntry[] => {
  const destinationPath = resolveAbsolutePath(username, rootId, destinationDirectory)
  if (!fs.existsSync(destinationPath) || !fs.statSync(destinationPath).isDirectory()) {
    throw new Error('Destination folder not found')
  }

  const rootPath = getRootAbsolutePath(username, rootId)
  const moved: FileEntry[] = []

  for (const sourceRelative of sources) {
    const sourcePath = resolveAbsolutePath(username, rootId, sourceRelative)
    const targetPath = path.join(destinationPath, path.basename(sourcePath))
    assertWithinRoot(rootPath, targetPath)

    if (fs.existsSync(targetPath)) {
      throw new Error(`Destination already exists: ${path.basename(targetPath)}`)
    }

    fs.renameSync(sourcePath, targetPath)
    moved.push(toFileEntry(rootPath, targetPath))
  }

  return moved
}

const uniqueDestinationPath = (destinationDirectory: string, baseName: string): string => {
  const ext = path.extname(baseName)
  const stem = path.basename(baseName, ext)
  let candidate = path.join(destinationDirectory, baseName)
  let counter = 1

  while (fs.existsSync(candidate)) {
    candidate = path.join(destinationDirectory, `${stem} (${counter})${ext}`)
    counter += 1
  }

  return candidate
}

const copyEntryRecursive = (sourcePath: string, destinationPath: string): void => {
  const stats = fs.statSync(sourcePath)
  if (stats.isDirectory()) {
    fs.mkdirSync(destinationPath, { recursive: true })
    for (const entry of fs.readdirSync(sourcePath)) {
      copyEntryRecursive(path.join(sourcePath, entry), path.join(destinationPath, entry))
    }
    return
  }

  fs.copyFileSync(sourcePath, destinationPath)
}

export const renamePath = (
  username: string,
  rootId: string,
  relativePath: string,
  newName: string,
): FileEntry => {
  if (!newName || newName.includes('/') || newName.includes('\\') || newName === '.' || newName === '..') {
    throw new Error('Invalid name')
  }

  const rootPath = getRootAbsolutePath(username, rootId)
  const sourcePath = resolveAbsolutePath(username, rootId, relativePath)
  const destinationPath = path.join(path.dirname(sourcePath), newName)
  assertWithinRoot(rootPath, destinationPath)

  if (fs.existsSync(destinationPath)) {
    throw new Error('Destination already exists')
  }

  fs.renameSync(sourcePath, destinationPath)
  return toFileEntry(rootPath, destinationPath)
}

export const copyPaths = (
  username: string,
  rootId: string,
  sources: string[],
  destinationDirectory: string,
): FileEntry[] => {
  const destinationPath = resolveAbsolutePath(username, rootId, destinationDirectory)
  if (!fs.existsSync(destinationPath) || !fs.statSync(destinationPath).isDirectory()) {
    throw new Error('Destination folder not found')
  }

  const rootPath = getRootAbsolutePath(username, rootId)
  const copied: FileEntry[] = []

  for (const sourceRelative of sources) {
    const sourcePath = resolveAbsolutePath(username, rootId, sourceRelative)
    const targetPath = uniqueDestinationPath(destinationPath, path.basename(sourcePath))
    assertWithinRoot(rootPath, targetPath)
    copyEntryRecursive(sourcePath, targetPath)
    copied.push(toFileEntry(rootPath, targetPath))
  }

  return copied
}

export const searchFiles = (
  username: string,
  rootId: string,
  relativePath: string,
  query: string,
  maxResults = 200,
): FileEntry[] => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  const rootPath = getRootAbsolutePath(username, rootId)
  const startPath = resolveAbsolutePath(username, rootId, relativePath)
  const results: FileEntry[] = []

  const walk = (currentPath: string): void => {
    if (results.length >= maxResults) {
      return
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= maxResults) {
        return
      }

      const absolutePath = path.join(currentPath, entry.name)
      const fileEntry = toFileEntry(rootPath, absolutePath)
      if (fileEntry.name.toLowerCase().includes(normalizedQuery)) {
        results.push(fileEntry)
      }

      if (entry.isDirectory()) {
        walk(absolutePath)
      }
    }
  }

  if (fs.statSync(startPath).isDirectory()) {
    walk(startPath)
  }

  return results
}

export const buildTreeNodes = (
  username: string,
  rootId: string,
  relativePath = '',
): Array<{ title: string; key: string; isLeaf: boolean }> => {
  let entries: FileEntry[] = []
  try {
    entries = listFiles(username, rootId, relativePath).filter((entry) => entry.type === 'directory')
  } catch {
    return []
  }

  return entries.map((entry) => {
    let hasChildDirectories = false
    try {
      hasChildDirectories = listFiles(username, rootId, entry.path).some((child) => child.type === 'directory')
    } catch {
      hasChildDirectories = false
    }

    return {
      title: entry.name,
      key: entry.path,
      isLeaf: !hasChildDirectories,
    }
  })
}
