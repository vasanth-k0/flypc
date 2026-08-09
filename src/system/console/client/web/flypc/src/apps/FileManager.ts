export type FileRoot = {
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

export type FileTreeNode = {
  title: string
  key: string
  isLeaf: boolean
  children?: FileTreeNode[]
}

export type ExplorerClipboard = {
  mode: 'cut' | 'copy'
  rootId: string
  paths: string[]
}

const buildAuthHeaders = (init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers ?? {})
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const authToken = window.localStorage.getItem('flypc-auth-token')
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  if (!headers.has('Content-Type') && init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: buildAuthHeaders(init),
  })

  const raw = await response.text()
  let payload: T & { error?: string; detail?: string }

  try {
    payload = JSON.parse(raw) as T & { error?: string; detail?: string }
  } catch {
    if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
      throw new Error('File API unavailable. Restart the FlyPC server and reload the page.')
    }
    throw new Error(`Unexpected server response (${response.status})`)
  }

  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed: ${response.status}`)
  }

  return payload
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.split(',')[1]! : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

export class FileManager {
  async listRoots(): Promise<FileRoot[]> {
    const payload = await apiFetch<{ ok: boolean; roots: FileRoot[] }>('/files/roots')
    return payload.roots
  }

  async list(rootId: string, relativePath = ''): Promise<{ entries: FileEntry[] }> {
    const params = new URLSearchParams({ root: rootId, path: relativePath })
    const payload = await apiFetch<{ ok: boolean; entries: FileEntry[] }>(
      `/files/list?${params.toString()}`,
    )
    return { entries: payload.entries }
  }

  async listTreeChildren(rootId: string, relativePath = ''): Promise<FileTreeNode[]> {
    const params = new URLSearchParams({ root: rootId, path: relativePath })
    const payload = await apiFetch<{ ok: boolean; nodes: FileTreeNode[] }>(
      `/files/tree?${params.toString()}`,
    )
    return payload.nodes
  }

  async search(rootId: string, relativePath: string, query: string): Promise<FileEntry[]> {
    const params = new URLSearchParams({ root: rootId, path: relativePath, q: query })
    const payload = await apiFetch<{ ok: boolean; entries: FileEntry[] }>(
      `/files/search?${params.toString()}`,
    )
    return payload.entries
  }

  async createFolder(rootId: string, relativePath: string, name: string): Promise<FileEntry> {
    const payload = await apiFetch<{ ok: boolean; entry: FileEntry }>('/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ root: rootId, path: relativePath, name }),
    })
    return payload.entry
  }

  async uploadFiles(rootId: string, relativePath: string, files: File[]): Promise<FileEntry[]> {
    const payload = await apiFetch<{ ok: boolean; entries: FileEntry[] }>('/files/upload', {
      method: 'POST',
      body: JSON.stringify({
        root: rootId,
        path: relativePath,
        files: await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            contentBase64: await readFileAsBase64(file),
          })),
        ),
      }),
    })
    return payload.entries
  }

  async uploadFilesWithProgress(
    rootId: string,
    relativePath: string,
    files: File[],
    onFileComplete?: (index: number, file: File) => void,
  ): Promise<FileEntry[]> {
    const uploaded: FileEntry[] = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!
      const entries = await this.uploadFiles(rootId, relativePath, [file])
      uploaded.push(...entries)
      onFileComplete?.(index, file)
    }

    return uploaded
  }

  async deletePaths(rootId: string, paths: string[]): Promise<void> {
    await apiFetch<{ ok: boolean }>('/files', {
      method: 'DELETE',
      body: JSON.stringify({ root: rootId, paths }),
    })
  }

  async movePaths(rootId: string, sources: string[], destination: string): Promise<FileEntry[]> {
    const payload = await apiFetch<{ ok: boolean; entries: FileEntry[] }>('/files/move', {
      method: 'PATCH',
      body: JSON.stringify({ root: rootId, sources, destination }),
    })
    return payload.entries
  }

  async copyPaths(rootId: string, sources: string[], destination: string): Promise<FileEntry[]> {
    const payload = await apiFetch<{ ok: boolean; entries: FileEntry[] }>('/files/copy', {
      method: 'POST',
      body: JSON.stringify({ root: rootId, sources, destination }),
    })
    return payload.entries
  }

  async renamePath(rootId: string, relativePath: string, name: string): Promise<FileEntry> {
    const payload = await apiFetch<{ ok: boolean; entry: FileEntry }>('/files/rename', {
      method: 'PATCH',
      body: JSON.stringify({ root: rootId, path: relativePath, name }),
    })
    return payload.entry
  }
}
