import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import SystemRouter from '../../routers/SystemRouter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const settingsFile = path.resolve(__dirname, '../../settings.json')

describe('SystemRouter', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use('/system', SystemRouter)
  })

  it('returns router status at GET /system', async () => {
    const response = await request(app).get('/system')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'system-router-active',
      routes: ['/system/settings', '/system/theme', '/system/update'],
    })
  })

  it('returns settings payload at GET /system/settings', async () => {
    const response = await request(app).get('/system/settings')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        ui: expect.any(String),
        colorPalette: expect.any(String),
      })
    )
  })

  it('returns theme settings as JSON with an active key at GET /system/theme', async () => {
    const response = await request(app).get('/system/theme')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual(
      expect.objectContaining({
        active: expect.any(String),
      })
    )
  })

  it('updates settings payload at POST /system/update', async () => {
    const originalRaw = fs.readFileSync(settingsFile, 'utf8')
    const originalSettings = JSON.parse(originalRaw) as { ui?: string }
    const nextUi = originalSettings.ui === 'desktop' ? 'dashboard' : 'desktop'

    try {
      const response = await request(app)
        .post('/system/update')
        .send({ action: 'update', property: 'ui', value: nextUi })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ ok: true, property: 'ui', value: nextUi })

      const updatedSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as { ui?: string }
      expect(updatedSettings.ui).toBe(nextUi)
    } finally {
      fs.writeFileSync(settingsFile, originalRaw, 'utf8')
    }
  })

  it('updates colorPalette at POST /system/update', async () => {
    const originalRaw = fs.readFileSync(settingsFile, 'utf8')
    const originalSettings = JSON.parse(originalRaw) as { colorPalette?: string }
    const nextPalette = originalSettings.colorPalette === 'Geekblue' ? 'Grey • Blue' : 'Geekblue'

    try {
      const response = await request(app)
        .post('/system/update')
        .send({ action: 'update', property: 'colorPalette', value: nextPalette })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ ok: true, property: 'colorPalette', value: nextPalette })

      const updatedSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as { colorPalette?: string }
      expect(updatedSettings.colorPalette).toBe(nextPalette)
    } finally {
      fs.writeFileSync(settingsFile, originalRaw, 'utf8')
    }
  })
})
