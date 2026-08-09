import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  buildTreeNodes,
  copyPaths,
  createDirectory,
  deletePaths,
  getFileRoots,
  getPublicFileRoots,
  listFiles,
  movePaths,
  renamePath,
  searchFiles,
  writeFile,
} from '../services/FileService.js'

const getUsername = (req: Request): string | null => {
  const username = (req as AuthenticatedRequest).authUser?.username
  if (!username || username === 'guest') {
    return null
  }
  return username
}

export const listFileRootsHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const roots = username ? getFileRoots(username) : getPublicFileRoots(false)
  res.json({ ok: true, roots })
}

export const listFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const rootId = String(req.query.root ?? '')
  const relativePath = String(req.query.path ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    res.json({
      ok: true,
      entries: listFiles(username, rootId, relativePath),
    })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to list files',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const listTreeHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const rootId = String(req.query.root ?? '')
  const relativePath = String(req.query.path ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    res.json({
      ok: true,
      nodes: buildTreeNodes(username, rootId, relativePath),
    })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to load folders',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const searchFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const rootId = String(req.query.root ?? '')
  const relativePath = String(req.query.path ?? '')
  const query = String(req.query.q ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    res.json({
      ok: true,
      entries: searchFiles(username, rootId, relativePath, query),
    })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to search files',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const createDirectoryHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, path: relativePath = '', name } = req.body as {
    root?: string
    path?: string
    name?: string
  }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    const entry = createDirectory(username, String(root ?? ''), String(relativePath), String(name ?? ''))
    res.json({ ok: true, entry })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to create folder',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const uploadFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, path: relativePath = '', files } = req.body as {
    root?: string
    path?: string
    files?: Array<{ name: string; contentBase64: string }>
  }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    const uploaded = (files ?? []).map((file) =>
      writeFile(
        username,
        String(root ?? ''),
        String(relativePath),
        file.name,
        Buffer.from(file.contentBase64, 'base64'),
      ),
    )
    res.json({ ok: true, entries: uploaded })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to upload files',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const deleteFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, paths } = req.body as { root?: string; paths?: string[] }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    deletePaths(username, String(root ?? ''), paths ?? [])
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to delete files',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const moveFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, sources, destination } = req.body as {
    root?: string
    sources?: string[]
    destination?: string
  }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    const entries = movePaths(username, String(root ?? ''), sources ?? [], String(destination ?? ''))
    res.json({ ok: true, entries })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to move files',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const renameFileHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, path: relativePath = '', name } = req.body as {
    root?: string
    path?: string
    name?: string
  }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    const entry = renamePath(username, String(root ?? ''), String(relativePath), String(name ?? ''))
    res.json({ ok: true, entry })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to rename item',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const copyFilesHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const { root, sources, destination } = req.body as {
    root?: string
    sources?: string[]
    destination?: string
  }

  if (!username) {
    res.status(401).json({ error: 'Authentication required', detail: 'Log in to access FlyDrive' })
    return
  }

  try {
    const entries = copyPaths(username, String(root ?? ''), sources ?? [], String(destination ?? ''))
    res.json({ ok: true, entries })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to copy items',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
