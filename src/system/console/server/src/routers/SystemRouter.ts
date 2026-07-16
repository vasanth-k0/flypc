import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const settingsFile = path.resolve(__dirname, '../settings.json')

router.get('/', (_req, res) => {
  res.json({
    status: 'system-router-active',
    routes: ['/system/settings', '/system/theme', '/system/update'],
  })
})

router.get('/settings', (_req, res) => {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8')
    const settings = JSON.parse(raw)

    return res.json(settings)
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to read system settings',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

router.get('/theme', (_req, res) => {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8')
    const settings = JSON.parse(raw)
    const themePayload = settings.theme ?? {
      default: 'Geekblue',
      active: settings.colorPalette ?? 'Geekblue',
    }

    return res.json(themePayload)
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to read theme settings',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

// POST /system/update
// Body: { action: 'update', property: string, value: unknown }
router.post('/update', express.json(), (req, res) => {
  try {
    const { action, property, value } = req.body as {
      action: string
      property: string
      value: unknown
    }

    if (action !== 'update') {
      return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    if (typeof property !== 'string' || property.trim() === '') {
      return res.status(400).json({ error: 'Missing or invalid property name' })
    }

    const raw = fs.readFileSync(settingsFile, 'utf8')
    const settings = JSON.parse(raw) as Record<string, unknown>

    settings[property] = value

    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 4), 'utf8')

    return res.json({ ok: true, property, value })
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to update system settings',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
