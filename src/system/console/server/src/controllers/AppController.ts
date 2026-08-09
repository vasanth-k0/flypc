import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import {
  getAppStatus,
  getAppStoragePath,
  removeAppContainer,
  startApp,
  stopApp,
} from '../services/AppService.js'
import { getContainerProgram } from '../lib/SystemSettings.js'

export const startAppHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!appKey) {
    res.status(400).json({ error: 'App key is required' })
    return
  }

  try {
    const result = await startApp(username, appKey)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      error: 'Unable to start app',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const stopAppHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!appKey) {
    res.status(400).json({ error: 'App key is required' })
    return
  }

  try {
    const result = await stopApp(username, appKey)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      error: 'Unable to stop app',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const removeAppHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!appKey) {
    res.status(400).json({ error: 'App key is required' })
    return
  }

  try {
    await removeAppContainer(username, appKey)
    res.json({ ok: true, appKey })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to remove app container',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const getAppStatusHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!appKey) {
    res.status(400).json({ error: 'App key is required' })
    return
  }

  try {
    const status = await getAppStatus(username, appKey)
    res.json({
      ok: true,
      appKey,
      storagePath: getAppStoragePath(username, appKey),
      containerProgram: getContainerProgram(),
      ...status,
    })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to read app status',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
