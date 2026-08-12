import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { getRealUsername } from '../middleware/requireRealUser.js'
import { getInstallContext } from '../services/AppControlsService.js'
import { apexService, type ApexInstallOptions } from '../services/ApexService.js'
import { loadApexCatalogEntry } from '../lib/ApexCatalog.js'
import { notificationService } from '../services/NotificationService.js'

const runApexInstallInBackground = (
  username: string,
  appKey: string,
  options: ApexInstallOptions,
  notificationId: string,
  appName: string,
): void => {
  void (async () => {
    try {
      await apexService.installApp(username, appKey, options)
      await notificationService.update(notificationId, username, {
        type: 'apex.install.success',
        title: `${appName} installed`,
        message: 'The app is ready to open from the launcher.',
        payload: { appKey, phase: 'success' },
        status: 'unread',
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      await notificationService.update(notificationId, username, {
        type: 'apex.install.failed',
        title: `${appName} install failed`,
        message: detail,
        payload: { appKey, phase: 'failed' },
        status: 'unread',
      })
    }
  })()
}

export const listApexCatalogHandler = (req: Request, res: Response): void => {
  const username = getRealUsername(req)
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
  const username = getRealUsername(req)
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

export const getApexInstallContextHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const context = await getInstallContext()
    res.json({ ok: true, ...context })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to load install context',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const installApexAppHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getRealUsername(req)
  const appKey = String(req.params.appKey ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const options = (req.body ?? {}) as ApexInstallOptions
    const entry = loadApexCatalogEntry(appKey)
    const notification = await notificationService.create({
      username,
      type: 'apex.install.pending',
      title: `Installing ${entry.manifest.name}…`,
      message: 'Installation is running in the background.',
      payload: { appKey, phase: 'running' },
    })

    runApexInstallInBackground(username, appKey, options, notification.id, entry.manifest.name)

    res.status(202).json({
      ok: true,
      accepted: true,
      notificationId: notification.id,
      message: 'Installation started. You will be notified when it completes.',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to install application',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const uninstallApexAppHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getRealUsername(req)
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
