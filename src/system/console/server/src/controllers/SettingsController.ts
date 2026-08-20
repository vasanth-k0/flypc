import fs from 'node:fs'
import type { Request, Response } from 'express'
import { getUserPreferencesPath, readBlueprint, writeBlueprint } from '../services/storage/TenantStorage.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'

const defaultColorPalette = 'Geekblue'
const colorPalettes = new Set([
  'White',
  'White • Blush',
  'White • Moss',
  'White • Sage',
  defaultColorPalette,
  'Indigo',
  'Slate',
  'Cyan',
  'Emerald',
  'Orange',
  'Amber',
  'Green',
  'Red',
  'Rose',
  'Purple',
  'Violet',
  'Teal',
  'Brown',
  'Gray',
  'Black',
  'Midnight',
  'Grey • Green',
  'Grey • Blue',
  'Grey • Teal',
  'Grey • Brown',
  'Charcoal • Mint',
  'Navy • Sky',
  'Black • Red',
  'Grey • Blush',
  'Moss • Mist',
  'Sage • Rose',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeColorPalette = (value: unknown) =>
  typeof value === 'string' && colorPalettes.has(value) ? value : defaultColorPalette

const normalizeThemeSettings = (settings: Record<string, unknown>) => ({
  ...settings,
  colorPalette: normalizeColorPalette(settings.colorPalette),
})

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
  const merged = normalizeThemeSettings({
    ...current,
    ...req.body,
  })

  fs.writeFileSync(preferencesPath, JSON.stringify(merged, null, 2), 'utf8')
  res.json({ ok: true, preferences: merged })
}

export const updateSystemBlueprint = async (req: Request, res: Response): Promise<void> => {
  if (!isRecord(req.body)) {
    res.status(400).json({ error: 'Payload must be a JSON object' })
    return
  }

  const blueprint = normalizeThemeSettings(req.body)
  writeBlueprint(blueprint)
  res.json({ ok: true, blueprint })
}

export const getSystemSettings = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username

  if (!username) {
    res.json(normalizeThemeSettings(readBlueprint()))
    return
  }

  const preferencesPath = getUserPreferencesPath(username)
  if (!fs.existsSync(preferencesPath)) {
    res.json(normalizeThemeSettings(readBlueprint()))
    return
  }

  const raw = fs.readFileSync(preferencesPath, 'utf8')
  res.json(normalizeThemeSettings(JSON.parse(raw) as Record<string, unknown>))
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

  const active = normalizeColorPalette(source.colorPalette)
  res.json({ default: defaultColorPalette, active })
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
  const next = normalizeThemeSettings({
    ...current,
    [property]: value,
  })

  writeBlueprint(next)
  res.json({ ok: true, property, value })
}
