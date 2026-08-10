import type { Request, Response } from 'express'
import {
  getDomainStatus,
  updateDomainConfig,
  type RHostDomainConfig,
  type RHostNodeRole,
  type RHostSslMode,
} from '../services/DomainService.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getDomainConfigHandler = (_req: Request, res: Response): void => {
  res.json({ ok: true, domain: getDomainStatus() })
}

export const updateDomainConfigHandler = (req: Request, res: Response): void => {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: 'Payload must be a JSON object' })
    return
  }

  const patch: Partial<RHostDomainConfig> & { completeInitialSetup?: boolean } = {}

  if (typeof req.body.brandOwner === 'string') patch.brandOwner = req.body.brandOwner
  if (typeof req.body.productName === 'string') patch.productName = req.body.productName
  if (typeof req.body.baseDomain === 'string') patch.baseDomain = req.body.baseDomain
  if (typeof req.body.accountSlug === 'string') patch.accountSlug = req.body.accountSlug
  if (typeof req.body.nodeRole === 'string') patch.nodeRole = req.body.nodeRole as RHostNodeRole
  if (typeof req.body.nodeId === 'string') patch.nodeId = req.body.nodeId
  if (typeof req.body.publicHost === 'string') patch.publicHost = req.body.publicHost
  if (typeof req.body.adminEmail === 'string') patch.adminEmail = req.body.adminEmail
  if (typeof req.body.sslMode === 'string') patch.sslMode = req.body.sslMode as RHostSslMode
  if (typeof req.body.httpsEnabled === 'boolean') patch.httpsEnabled = req.body.httpsEnabled
  if (req.body.completeInitialSetup === true) patch.completeInitialSetup = true

  try {
    const domain = updateDomainConfig(patch)
    res.json({ ok: true, domain: { ...domain, ...getDomainStatus() } })
  } catch (error) {
    res.status(400).json({
      error: 'Unable to update domain configuration',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const applyDomainSslHandler = (_req: Request, res: Response): void => {
  try {
    updateDomainConfig({})
    res.json({
      ok: true,
      domain: getDomainStatus(),
      message: 'SSL profile regenerated',
    })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to apply SSL profile',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
