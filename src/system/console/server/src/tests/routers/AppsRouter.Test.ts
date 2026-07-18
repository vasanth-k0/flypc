import express from 'express'
import request from 'supertest'
import AppsRouter from '../../routers/AppsRouter.js'

describe('AppsRouter', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(AppsRouter)
  })

  it('returns router status at GET /apps', async () => {
    const response = await request(app).get('/apps')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'apps-router-active',
      routes: ['/apps/list'],
    })
  })

  it('returns apps list at GET /apps/list', async () => {
    const response = await request(app).get('/apps/list')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'notepad',
          name: 'Notepad',
          icon: 'EditFilled',
          published: true,
        }),
        expect.objectContaining({
          key: 'terminal',
          name: 'Terminal',
          icon: 'CodeFilled',
          published: false,
        }),
      ])
    )
  })
})
