import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type AppDefinition = {
  name: string
  icon: string
  published: boolean
  users: string[]
}

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appsFileCandidates = [
  path.resolve(__dirname, '../apps.json'),
  path.resolve(process.cwd(), 'src/apps.json'),
]
const appsFile = appsFileCandidates.find((candidate) => fs.existsSync(candidate)) ?? appsFileCandidates[0]

router.get('/', (_req, res) => {
  res.json({
    status: 'apps-router-active',
    routes: ['/apps/list'],
  })
})

router.get('/list', (_req, res) => {
  try {
    const raw = fs.readFileSync(appsFile, 'utf8')
    const apps = JSON.parse(raw) as Record<string, AppDefinition>

    const list = Object.entries(apps).map(([key, app]) => ({
      key,
      ...app,
    }))

    return res.json(list)
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to read apps list',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
