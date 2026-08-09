import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { apexService } from '../services/ApexService.js'

const getUsername = (req: Request): string | null => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  if (!username || username === 'guest') {
    return null
  }
  return username
}

export const listApexCatalogHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    res.json({ ok: true, apps: apexService.listStoreApps(username) })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to load Apex catalog',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const getApexCatalogAppHandler = (req: Request, res: Response): void => {
  const username = getUsername(req)
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!/^[a-z0-9-]+$/i.test(appKey)) {
    res.status(400).json({ error: 'Invalid application key' })
    return
  }

  try {
    res.json({ ok: true, app: apexService.getStoreApp(appKey, username) })
  } catch (error) {
    res.status(404).json({
      error: 'Application not found in Apex catalog',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const installApexAppHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const app = await apexService.installApp(username, appKey)
    res.json({ ok: true, app })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to install application',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const uninstallApexAppHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const app = await apexService.uninstallApp(username, appKey)
    res.json({ ok: true, app })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to uninstall application',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const uninstallApexAppForAllHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const appKey = String(req.params.appKey ?? '')

  if (typedReq.authUser?.role !== 'Admin') {
    res.status(403).json({ error: 'Admin privileges required' })
    return
  }

  try {
    const result = await apexService.uninstallAppForAllUsers(appKey)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      error: 'Unable to remove application for all users',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
