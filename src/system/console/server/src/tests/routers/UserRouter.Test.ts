import express from 'express'
import session from 'express-session'
import { expressjwt } from 'express-jwt'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

describe('UserRouter', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-user-router-'))
  const sqliteStorage = path.join(tempRoot, 'database.sqlite')
  const tenantHomeRoot = path.join(tempRoot, 'homes')
  let app: express.Express

  const loginAndGetToken = async (username: string, password: string): Promise<string> => {
    const response = await request(app).post('/user/login').send({ username, password })
    expect(response.status).toBe(200)
    return response.body.token as string
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

  it('rejects usernames with special characters', async () => {
    const adminToken = await loginAndGetToken('admin', 'Admin@123')
    const response = await request(app)
      .post('/user/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'user@invalid',
        password: 'password123',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation failed')
  })

  it('rejects short passwords during registration', async () => {
    const adminToken = await loginAndGetToken('admin', 'Admin@123')
    const response = await request(app)
      .post('/user/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'shortpass1',
        password: 'short',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation failed')
  })

  it('blocks registration without admin auth', async () => {
    const response = await request(app).post('/user/register').send({
      username: 'blockeduser1',
      password: 'password123',
    })

    expect(response.status).toBe(401)
  })

  it('registers and logs in a valid user', async () => {
    const adminToken = await loginAndGetToken('admin', 'Admin@123')
    const register = await request(app)
      .post('/user/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'validuser1',
        password: 'password123',
      })

    expect(register.status).toBe(201)
    expect(register.body.ok).toBe(true)

    const login = await request(app).post('/user/login').send({
      username: 'validuser1',
      password: 'password123',
    })

    expect(login.status).toBe(200)
    expect(login.body.ok).toBe(true)
    expect(login.body.token).toEqual(expect.any(String))
  })

  it('blocks remove endpoint without auth', async () => {
    const response = await request(app).post('/user/remove').send({ username: 'validuser1' })
    expect(response.status).toBe(401)
  })

  it('changes username and allows login with new username', async () => {
    const token = await loginAndGetToken('validuser1', 'password123')

    const changeNameResponse = await request(app)
      .post('/user/change-name')
      .set('Authorization', `Bearer ${token}`)
      .send({ newUsername: 'validuser2' })

    expect(changeNameResponse.status).toBe(200)
    expect(changeNameResponse.body.ok).toBe(true)
    expect(changeNameResponse.body.user.username).toBe('validuser2')

    const loginWithOldName = await request(app).post('/user/login').send({
      username: 'validuser1',
      password: 'password123',
    })
    expect(loginWithOldName.status).toBe(401)

    const loginWithNewName = await request(app).post('/user/login').send({
      username: 'validuser2',
      password: 'password123',
    })
    expect(loginWithNewName.status).toBe(200)
  })

  it('resets password for authenticated user', async () => {
    const token = await loginAndGetToken('validuser2', 'password123')

    const resetResponse = await request(app)
      .post('/user/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'password123', newPassword: 'newpassword123' })

    expect(resetResponse.status).toBe(200)
    expect(resetResponse.body.ok).toBe(true)

    const oldLogin = await request(app).post('/user/login').send({
      username: 'validuser2',
      password: 'password123',
    })
    expect(oldLogin.status).toBe(401)

    const newLogin = await request(app).post('/user/login').send({
      username: 'validuser2',
      password: 'newpassword123',
    })
    expect(newLogin.status).toBe(200)
  })

  it('returns admin members with created date and storage usage stats', async () => {
    const userHome = path.join(tenantHomeRoot, 'validuser2')
    fs.mkdirSync(userHome, { recursive: true })
    fs.writeFileSync(path.join(userHome, 'sample.bin'), Buffer.alloc(8 * 1024))

    const adminToken = await loginAndGetToken('admin', 'Admin@123')
    const response = await request(app)
      .get('/user/members')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(Array.isArray(response.body.members)).toBe(true)

    const member = (response.body.members as Array<Record<string, unknown>>).find(
      (entry) => entry.username === 'validuser2'
    )

    expect(member).toBeDefined()
    expect(typeof member?.createdAt).toBe('string')
    expect(typeof member?.totalStorageBytes).toBe('number')
    expect(typeof member?.usagePercent).toBe('number')
    expect((member?.totalStorageBytes as number) > 0).toBe(true)
  })
})
