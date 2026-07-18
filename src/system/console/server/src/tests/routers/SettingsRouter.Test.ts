import express from 'express'
import session from 'express-session'
import { expressjwt } from 'express-jwt'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

describe('SettingsRouter', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-settings-router-'))
  const sqliteStorage = path.join(tempRoot, 'database.sqlite')
  const tenantHomeRoot = path.join(tempRoot, 'homes')
  let app: express.Express

  const loginAndGetToken = async (username: string, password: string): Promise<string> => {
    const response = await request(app).post('/user/login').send({ username, password })
    expect(response.status).toBe(200)
    return response.body.token as string
  }

  const registerAsAdmin = async (username: string, password: string): Promise<void> => {
    const adminToken = await loginAndGetToken('admin', 'Admin@123')
    const response = await request(app)
      .post('/user/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password })

    expect(response.status).toBe(201)
  }

  beforeAll(async () => {
    process.env.SQLITE_STORAGE = sqliteStorage
    process.env.TENANT_HOME_ROOT = tenantHomeRoot
    process.env.DISABLE_CSRF = 'true'
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.SESSION_SECRET = 'test-session-secret'

    const [{ initializeDatabase }, { default: AppsRouter }] = await Promise.all([
      import('../../db/index.js'),
      import('../../routers/AppsRouter.js'),
    ])

    await initializeDatabase()

    app = express()
    app.use(express.json())
    app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
      })
    )
    app.use(
      expressjwt({
        secret: 'test-jwt-secret',
        algorithms: ['HS256'],
        credentialsRequired: false,
        requestProperty: 'auth',
      })
    )
    app.use(AppsRouter)
  })

  afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  it('denies preferences update without auth', async () => {
    const response = await request(app).post('/settings/preferences').send({ ui: 'dashboard' })
    expect(response.status).toBe(401)
  })

  it('writes tenant isolated preferences for authenticated users', async () => {
    const username = 'settingsuser1'
    const password = 'password123'

    await registerAsAdmin(username, password)

    const token = await loginAndGetToken(username, password)

    const response = await request(app)
      .put('/settings/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ ui: 'dashboard', wallp: 7 })

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.preferences.ui).toBe('dashboard')

    const preferencePath = path.join(tenantHomeRoot, username, 'preferences.json')
    const stored = JSON.parse(fs.readFileSync(preferencePath, 'utf8')) as { ui: string; wallp: number }
    expect(stored.ui).toBe('dashboard')
    expect(stored.wallp).toBe(7)
  })

  it('blocks non-admin from system blueprint updates', async () => {
    const username = 'basicuser1'
    const password = 'password123'

    await registerAsAdmin(username, password)

    const token = await loginAndGetToken(username, password)

    const response = await request(app)
      .post('/system/blueprint')
      .set('Authorization', `Bearer ${token}`)
      .send({ ui: 'hybrid-console' })

    expect(response.status).toBe(403)
  })

  it('allows admin to overwrite system blueprint', async () => {
    const adminToken = await loginAndGetToken('admin', 'Admin@123')

    const payload = {
      name: 'Mr. Admin',
      colorPalette: 'Geekblue',
      ui: 'hybrid-console',
      gotoConsole: true,
      defaultApp: 'coderun-lite',
      wallp: 2,
    }

    const response = await request(app)
      .put('/system/blueprint')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.blueprint).toEqual(payload)
  })
})
