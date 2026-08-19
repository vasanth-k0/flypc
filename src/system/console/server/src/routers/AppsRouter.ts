import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import UserRouter from './UserRouter.js'
import SettingsRouter from './SettingsRouter.js'
import {
  filterAccessibleApps,
  requireAppAccess,
  resolveAppUser,
} from '../middleware/appAccess.middleware.js'
import {
  getAppStatusHandler,
  pauseAppHandler,
  removeAppHandler,
  startAppHandler,
  stopAppHandler,
} from '../controllers/AppController.js'
import { runAppActionHandler } from '../controllers/RunOnceController.js'
import {
  getApexCatalogAppHandler,
  getApexInstallContextHandler,
  installApexAppHandler,
  listApexCatalogHandler,
  uninstallApexAppForAllHandler,
  uninstallApexAppHandler,
} from '../controllers/ApexController.js'
import {
  getControlsConfigHandler,
  getControlsMetaHandler,
  getControlsNodesHandler,
  getControlsStatusHandler,
  getBootStatusHandler,
  getServiceConfigViewHandler,
  postControlsRolloutHandler,
  putControlsConfigHandler,
  putServiceConfigAdminHandler,
} from '../controllers/AppControlsController.js'
import { appProxyHandler } from '../controllers/AppProxyController.js'
import { getAppViewRoot, getAppsIndexPath, getAppMetadataRoot } from '../lib/PathResolver.js'
import { loadServiceDefinition } from '../services/ServiceRegistry.js'
import { getWarmStartProgress } from '../services/AppWarmStartService.js'

const router = express.Router()
const appsFile = getAppsIndexPath()
const appsRoot = getAppMetadataRoot()

const getAppDescription = (appKey: string): string | undefined => {
  const aboutPath = path.join(appsRoot, appKey, 'about.md')
  if (!fs.existsSync(aboutPath)) return undefined

  return fs.readFileSync(aboutPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('-'))
}

router.get('/apps', (_req, res) => {
  res.json({
    status: 'apps-router-active',
    routes: ['/apps/list'],
  })
})

router.get('/apps/list', resolveAppUser, filterAccessibleApps(appsFile), (_req, res) => {
  const accessibleApps = res.locals.accessibleApps as Array<Record<string, unknown> & { key: string }> | undefined
  res.json((accessibleApps ?? []).map((app) => ({ ...app, description: getAppDescription(app.key) })))
})

router.get('/apps/apex/catalog', resolveAppUser, listApexCatalogHandler)
router.get('/apps/apex/install-context', resolveAppUser, getApexInstallContextHandler)
router.get('/apps/apex/catalog/:appKey', resolveAppUser, getApexCatalogAppHandler)
router.post('/apps/apex/catalog/:appKey/install', resolveAppUser, installApexAppHandler)
router.delete('/apps/apex/catalog/:appKey/install', resolveAppUser, uninstallApexAppHandler)
router.delete('/apps/apex/catalog/:appKey/install/all', resolveAppUser, uninstallApexAppForAllHandler)
router.get('/apps/warm-start/status', resolveAppUser, (_req, res) => {
  res.json({ ok: true, progress: getWarmStartProgress() })
})

router.get('/apps/:appKey/controls/meta', resolveAppUser, requireAppAccess(appsFile), getControlsMetaHandler)
router.get('/apps/:appKey/controls/config', resolveAppUser, requireAppAccess(appsFile), getControlsConfigHandler)
router.get('/apps/:appKey/controls/service-config', resolveAppUser, requireAppAccess(appsFile), getServiceConfigViewHandler)
router.put('/apps/:appKey/controls/service-config', resolveAppUser, requireAppAccess(appsFile), putServiceConfigAdminHandler)
router.put('/apps/:appKey/controls/config', resolveAppUser, requireAppAccess(appsFile), putControlsConfigHandler)
router.get('/apps/:appKey/controls/status', resolveAppUser, requireAppAccess(appsFile), getControlsStatusHandler)
router.get('/apps/:appKey/boot-status', resolveAppUser, requireAppAccess(appsFile), getBootStatusHandler)
router.post('/apps/:appKey/controls/rollout', resolveAppUser, requireAppAccess(appsFile), postControlsRolloutHandler)
router.get('/apps/:appKey/controls/nodes', resolveAppUser, requireAppAccess(appsFile), getControlsNodesHandler)
router.all('/apps/:appKey/proxy', resolveAppUser, requireAppAccess(appsFile), appProxyHandler)
router.all('/apps/:appKey/proxy/{*path}', resolveAppUser, requireAppAccess(appsFile), appProxyHandler)

router.get('/apps/:appKey/about', resolveAppUser, requireAppAccess(appsFile), (req, res) => {
  const appKey = String(req.params.appKey ?? '')
  if (!/^[a-z0-9-]+$/i.test(appKey)) {
    return res.status(400).send('Invalid application key')
  }

  const aboutPath = path.join(appsRoot, appKey, 'about.md')
  if (!fs.existsSync(aboutPath)) {
    return res.status(404).send('Application controls are unavailable.')
  }

  return res.type('text/markdown').send(fs.readFileSync(aboutPath, 'utf8'))
})

router.post('/apps/:appKey/start', resolveAppUser, requireAppAccess(appsFile), startAppHandler)
router.post('/apps/:appKey/pause', resolveAppUser, requireAppAccess(appsFile), pauseAppHandler)
router.post('/apps/:appKey/stop', resolveAppUser, requireAppAccess(appsFile), stopAppHandler)
router.delete('/apps/:appKey/container', resolveAppUser, requireAppAccess(appsFile), removeAppHandler)
router.get('/apps/:appKey/status', resolveAppUser, requireAppAccess(appsFile), getAppStatusHandler)
router.post('/apps/:appKey/run/:action', resolveAppUser, requireAppAccess(appsFile), runAppActionHandler)

router.get('/apps/:appKey/view', resolveAppUser, requireAppAccess(appsFile), (req, res) => {
  const appKey = String(req.params.appKey ?? '')
  try {
    const service = loadServiceDefinition(appKey)
    const viewRoot = getAppViewRoot(service.dir ?? '')
    const indexPath = path.join(viewRoot, 'index.html')
    if (!fs.existsSync(indexPath)) {
      return res.status(404).send('Application view is not built yet.')
    }
    return res.sendFile(indexPath)
  } catch (error) {
    return res.status(500).send(error instanceof Error ? error.message : String(error))
  }
})

router.use('/apps/:appKey/view', resolveAppUser, requireAppAccess(appsFile), (req, res, next) => {
  const appKey = String(req.params.appKey ?? '')
  try {
    const service = loadServiceDefinition(appKey)
    const viewRoot = getAppViewRoot(service.dir ?? '')
    if (!fs.existsSync(viewRoot)) {
      return res.status(404).send('Application view is not built yet.')
    }
    return express.static(viewRoot)(req, res, next)
  } catch (error) {
    return next(error)
  }
})

router.use(UserRouter)
router.use(SettingsRouter)

export default router
