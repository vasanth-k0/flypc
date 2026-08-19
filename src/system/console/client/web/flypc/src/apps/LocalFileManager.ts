import type { FileEntry, FileTreeNode } from './FileManager'

const splitPath = (relativePath: string): string[] => relativePath.split('/').filter(Boolean)

const sortEntries = (entries: FileEntry[]): FileEntry[] =>
  entries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1
    }
    return left.name.localeCompare(right.name)
  })

const uniqueName = (existingNames: Set<string>, baseName: string): string => {
  if (!existingNames.has(baseName)) {
    return baseName
  }

  const ext = baseName.includes('.') ? baseName.slice(baseName.lastIndexOf('.')) : ''
  const stem = ext ? baseName.slice(0, -ext.length) : baseName
  let counter = 1
  let candidate = `${stem} (${counter})${ext}`

  while (existingNames.has(candidate)) {
    counter += 1
    candidate = `${stem} (${counter})${ext}`
  }

  return candidate
}

export class LocalFileManager {
  private rootHandle: FileSystemDirectoryHandle | null = null
  private rootLabel = 'This PC'

  isSupported(): boolean {
    return typeof window.showDirectoryPicker === 'function'
  }

  isConnected(): boolean {
    return this.rootHandle !== null
  }

  getRootLabel(): string {
    return this.rootLabel
  }

  async connect(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Local folder access is not supported in this browser')
    }

    const picker = window.showDirectoryPicker
    if (!picker) {
      throw new Error('Local folder access is not supported in this browser')
    }

    const handle = await picker({ mode: 'readwrite' })
    this.rootHandle = handle
    this.rootLabel = handle.name
    return true
  }

  private async resolveDirectory(relativePath: string): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) {
      throw new Error('Choose a folder on this device first')
    }

    let current = this.rootHandle
    for (const segment of splitPath(relativePath)) {
      current = await current.getDirectoryHandle(segment)
    }
    return current
  }

  private async resolveParent(relativePath: string): Promise<{
    parent: FileSystemDirectoryHandle
    name: string
  }> {
    const segments = splitPath(relativePath)
    const name = segments.pop()
    if (!name) {
      throw new Error('Invalid path')
    }

    return {
      parent: await this.resolveDirectory(segments.join('/')),
      name,
    }
  }

  async list(relativePath = ''): Promise<FileEntry[]> {
    const directory = await this.resolveDirectory(relativePath)
    const entries: FileEntry[] = []

    for await (const [name, handle] of directory.entries()) {
      const childPath = relativePath ? `${relativePath}/${name}` : name
      if (handle.kind === 'directory') {
        entries.push({
          name,
          path: childPath,
          type: 'directory',
          size: 0,
          modifiedAt: new Date().toISOString(),
        })
        continue
      }

      const file = await handle.getFile()
      entries.push({
        name,
        path: childPath,
        type: 'file',
        size: file.size,
        modifiedAt: new Date(file.lastModified).toISOString(),
      })
    }

    return sortEntries(entries)
  }

  async listTreeChildren(relativePath = ''): Promise<FileTreeNode[]> {
    const entries = (await this.list(relativePath)).filter((entry) => entry.type === 'directory')
    const nodes: FileTreeNode[] = []

    for (const entry of entries) {
      let hasChildDirectories = false
      try {
        hasChildDirectories = (await this.list(entry.path)).some((child) => child.type === 'directory')
      } catch {
        hasChildDirectories = false
      }

      nodes.push({
        title: entry.name,
        key: entry.path,
        isLeaf: !hasChildDirectories,
      })
    }

    return nodes
  }

  async search(relativePath: string, query: string, maxResults = 200): Promise<FileEntry[]> {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return []
    }

    const results: FileEntry[] = []

    const walk = async (pathPrefix: string): Promise<void> => {
      if (results.length >= maxResults) {
        return
      }

      const entries = await this.list(pathPrefix)
      for (const entry of entries) {
        if (results.length >= maxResults) {
          return
        }

        if (entry.name.toLowerCase().includes(normalizedQuery)) {
          results.push(entry)
        }

        if (entry.type === 'directory') {
          await walk(entry.path)
        }
      }
    }

    await walk(relativePath)
    return results
  }

  async createFolder(relativePath: string, name: string): Promise<FileEntry> {
    const parent = await this.resolveDirectory(relativePath)
    await parent.getDirectoryHandle(name, { create: true })
    const childPath = relativePath ? `${relativePath}/${name}` : name
    return {
      name,
      path: childPath,
      type: 'directory',
      size: 0,
      modifiedAt: new Date().toISOString(),
    }
  }

  async deletePaths(paths: string[]): Promise<void> {
    for (const relativePath of paths) {
      const { parent, name } = await this.resolveParent(relativePath)
      await parent.removeEntry(name, { recursive: true })
    }
  }

  async renamePath(relativePath: string, newName: string): Promise<FileEntry> {
    const { parent, name } = await this.resolveParent(relativePath)
    const parentPath = splitPath(relativePath).slice(0, -1).join('/')
    const nextPath = parentPath ? `${parentPath}/${newName}` : newName

    try {
      const fileHandle = await parent.getFileHandle(name)
      if ('move' in fileHandle && typeof fileHandle.move === 'function') {
        await fileHandle.move(newName)
      } else {
        const file = await fileHandle.getFile()
        const nextHandle = await parent.getFileHandle(newName, { create: true })
        const writable = await nextHandle.createWritable()
        await writable.write(file)
        await writable.close()
        await parent.removeEntry(name)
      }

      return {
        name: newName,
        path: nextPath,
        type: 'file',
        size: 0,
        modifiedAt: new Date().toISOString(),
      }
    } catch {
      const directoryHandle = await parent.getDirectoryHandle(name)
      if ('move' in directoryHandle && typeof directoryHandle.move === 'function') {
        await directoryHandle.move(newName)
      } else {
        throw new Error('Rename is not supported in this browser')
      }

      return {
        name: newName,
        path: nextPath,
        type: 'directory',
        size: 0,
        modifiedAt: new Date().toISOString(),
      }
    }
  }

  async movePaths(sources: string[], destinationDirectory: string): Promise<FileEntry[]> {
    const destination = await this.resolveDirectory(destinationDirectory)
    const moved: FileEntry[] = []

    for (const sourceRelative of sources) {
      const { parent, name } = await this.resolveParent(sourceRelative)
      const sourceHandle = await parent.getFileHandle(name).catch(async () => parent.getDirectoryHandle(name))

      if ('move' in sourceHandle && typeof sourceHandle.move === 'function') {
        await sourceHandle.move(destination)
      } else {
        throw new Error('Move is not supported in this browser')
      }

      const nextPath = destinationDirectory ? `${destinationDirectory}/${name}` : name
      moved.push({
        name,
        path: nextPath,
        type: sourceHandle.kind === 'directory' ? 'directory' : 'file',
        size: 0,
        modifiedAt: new Date().toISOString(),
      })
    }

    return moved
  }

  async copyPaths(sources: string[], destinationDirectory: string): Promise<FileEntry[]> {
    const destination = await this.resolveDirectory(destinationDirectory)
    const existingNames = new Set<string>()
    for await (const [name] of destination.entries()) {
      existingNames.add(name)
    }

    const copied: FileEntry[] = []

    for (const sourceRelative of sources) {
      const { parent, name } = await this.resolveParent(sourceRelative)
      const nextName = uniqueName(existingNames, name)
      existingNames.add(nextName)

      const sourceHandle = await parent.getFileHandle(name).catch(async () => parent.getDirectoryHandle(name))
      if (sourceHandle.kind === 'file') {
        const file = await sourceHandle.getFile()
        const targetHandle = await destination.getFileHandle(nextName, { create: true })
        const writable = await targetHandle.createWritable()
        await writable.write(file)
        await writable.close()
      } else {
        await this.copyDirectoryRecursive(sourceHandle, destination, nextName)
      }

      const nextPath = destinationDirectory ? `${destinationDirectory}/${nextName}` : nextName
      copied.push({
        name: nextName,
        path: nextPath,
        type: sourceHandle.kind === 'directory' ? 'directory' : 'file',
        size: 0,
        modifiedAt: new Date().toISOString(),
      })
    }

    return copied
  }

  private async copyDirectoryRecursive(
    sourceDirectory: FileSystemDirectoryHandle,
    destinationDirectory: FileSystemDirectoryHandle,
    folderName: string,
  ): Promise<void> {
    const targetDirectory = await destinationDirectory.getDirectoryHandle(folderName, { create: true })

    for await (const [name, handle] of sourceDirectory.entries()) {
      if (handle.kind === 'directory') {
        await this.copyDirectoryRecursive(handle, targetDirectory, name)
        continue
      }

      const file = await handle.getFile()
      const targetHandle = await targetDirectory.getFileHandle(name, { create: true })
      const writable = await targetHandle.createWritable()
      await writable.write(file)
      await writable.close()
    }
  }

  async writeFiles(relativePath: string, files: File[]): Promise<void> {
    const directory = await this.resolveDirectory(relativePath)

    for (const file of files) {
      const handle = await directory.getFileHandle(file.name, { create: true })
      const writable = await handle.createWritable()
      await writable.write(file)
      await writable.close()
    }
  }

  async readFiles(relativePaths: string[]): Promise<File[]> {
    const files: File[] = []

    for (const relativePath of relativePaths) {
      const { parent, name } = await this.resolveParent(relativePath)
      const handle = await parent.getFileHandle(name)
      files.push(await handle.getFile())
    }

    return files
  }

  async collectFilesFromPaths(relativePaths: string[]): Promise<Array<{ file: File; relativePath: string }>> {
    const collected: Array<{ file: File; relativePath: string }> = []

    const walkDirectory = async (directoryPath: string): Promise<void> => {
      const entries = await this.list(directoryPath)
      for (const entry of entries) {
        if (entry.type === 'directory') {
          await walkDirectory(entry.path)
          continue
        }

        const { parent, name } = await this.resolveParent(entry.path)
        const handle = await parent.getFileHandle(name)
        collected.push({
          file: await handle.getFile(),
          relativePath: entry.path,
        })
      }
    }

    for (const relativePath of relativePaths) {
      try {
        const { parent, name } = await this.resolveParent(relativePath)
        const handle = await parent.getFileHandle(name)
        collected.push({
          file: await handle.getFile(),
          relativePath,
        })
      } catch {
        await walkDirectory(relativePath)
      }
    }

    return collected
  }
}
