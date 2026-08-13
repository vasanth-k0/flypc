import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import type { AppVolume, AppRuntime, KubeConfig, ServiceDefinition } from '../types/ServiceDefinition.js'
import {
  getClusterNodes,
  getControlPaneConfig,
  getControlPaneMeta,
  getServiceConfigView,
  getWorkloadStatus,
  rolloutWorkload,
  updateControlPaneConfig,
  updateServiceConfigAdmin,
} from '../services/AppControlsService.js'
import { getBootStatus } from '../services/AppBootService.js'
import { getDockerRuntimeStatus } from '../services/AppService.js'

const getUsername = (req: Request): string => {
  const typedReq = req as AuthenticatedRequest
  return typedReq.authUser?.username ?? 'admin'
}

export const getControlsMetaHandler = (req: Request, res: Response): void => {
  const appKey = String(req.params.appKey ?? '')
  res.json(getControlPaneMeta(appKey))
}

export const getControlsConfigHandler = (req: Request, res: Response): void => {
  const appKey = String(req.params.appKey ?? '')
  try {
    res.json(getControlPaneConfig(appKey))
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const putControlsConfigHandler = async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? '')
  const username = getUsername(req)
  const body = req.body as {
    runtime?: AppRuntime
    volumes?: AppVolume[]
    kube?: KubeConfig
  }

  try {
    const config = await updateControlPaneConfig(appKey, username, body)
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const getControlsStatusHandler = async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? '')
  const username = getUsername(req)
  const meta = getControlPaneMeta(appKey)

  if (meta.managementMode === 'kubernetes') {
    const status = await getWorkloadStatus(appKey, username)
    res.json({ mode: 'kubernetes', status })
    return
  }

  if (meta.managementMode === 'docker') {
    const docker = await getDockerRuntimeStatus(username, appKey)
    res.json({ mode: 'docker', status: docker })
    return
  }

  res.json({ mode: 'static', status: null })
}

export const getServiceConfigViewHandler = (req: Request, res: Response): void => {
  const appKey = String(req.params.appKey ?? '')
  const username = getUsername(req)

  try {
    res.json(getServiceConfigView(appKey, username))
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const putServiceConfigAdminHandler = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  if (typedReq.authUser?.role !== 'Admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }

  const appKey = String(req.params.appKey ?? '')
  const patch = req.body as Partial<ServiceDefinition>

  try {
    const config = await updateServiceConfigAdmin(appKey, patch)
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const getBootStatusHandler = async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? '')
  const username = getUsername(req)

  try {
    const status = await getBootStatus(username, appKey)
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const postControlsRolloutHandler = async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? '')
  const username = getUsername(req)

  try {
    const status = await rolloutWorkload(appKey, username)
    res.json(status)
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export const getControlsNodesHandler = async (_req: Request, res: Response): Promise<void> => {
  const nodes = await getClusterNodes()
  res.json({ nodes })
}
