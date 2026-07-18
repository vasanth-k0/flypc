import fs from 'node:fs'
import type { Request, Response } from 'express'
import { getUserPreferencesPath, readBlueprint, writeBlueprint } from './TenantStorage.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const user = typedReq.authUser

  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!isRecord(req.body)) {
    res.status(400).json({ error: 'Payload must be a JSON object' })
    return
  }

  const preferencesPath = getUserPreferencesPath(user.username)
  const currentRaw = fs.existsSync(preferencesPath)
    ? fs.readFileSync(preferencesPath, 'utf8')
    : JSON.stringify(readBlueprint())

  const current = JSON.parse(currentRaw) as Record<string, unknown>
  const merged = {
    ...current,
    ...req.body,
  }

  fs.writeFileSync(preferencesPath, JSON.stringify(merged, null, 2), 'utf8')
  res.json({ ok: true, preferences: merged })
}

export const updateSystemBlueprint = async (req: Request, res: Response): Promise<void> => {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: 'Payload must be a JSON object' })
    return
  }

  writeBlueprint(req.body)
  res.json({ ok: true, blueprint: req.body })
}

export const getSystemSettings = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username

  if (!username) {
    res.json(readBlueprint())
    return
  }

  const preferencesPath = getUserPreferencesPath(username)
  if (!fs.existsSync(preferencesPath)) {
    res.json(readBlueprint())
    return
  }

  const raw = fs.readFileSync(preferencesPath, 'utf8')
  res.json(JSON.parse(raw) as Record<string, unknown>)
}

export const getSystemTheme = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username

  let source = readBlueprint()
  if (username) {
    const preferencesPath = getUserPreferencesPath(username)
    if (fs.existsSync(preferencesPath)) {
      const raw = fs.readFileSync(preferencesPath, 'utf8')
      source = JSON.parse(raw) as Record<string, unknown>
    }
  }

  const active = String(source.colorPalette ?? 'Geekblue')
  res.json({ default: 'Geekblue', active })
}

export const updateSystemSettingCompat = async (req: Request, res: Response): Promise<void> => {
  const { action, property, value } = req.body as {
    action?: string
    property?: string
    value?: unknown
  }

  if (action !== 'update' || typeof property !== 'string' || property.trim().length === 0) {
    res.status(400).json({ error: 'Invalid update request' })
    return
  }

  const current = readBlueprint()
  const next = {
    ...current,
    [property]: value,
  }

  writeBlueprint(next)
  res.json({ ok: true, property, value })
}
