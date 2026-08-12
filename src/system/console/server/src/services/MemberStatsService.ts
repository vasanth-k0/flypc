import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getUserHomePath } from './storage/TenantStorage.js'

const USER_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appsFileCandidates = [
  path.resolve(__dirname, '../apps.json'),
  path.resolve(process.cwd(), 'src/apps.json'),
]

type AppDefinition = {
  name: string
  users?: string[]
}

export type AuthMemberRecord = {
  id: string
  username: string
  role: string
  createdAt: string | Date
}

export type EnrichedMemberRecord = {
  id: string
  username: string
  role: string
  createdAt: string | Date
  apps: string[]
  totalStorageBytes: number
  totalStorageMB: number
  usagePercent: number
}

const getDirectorySize = (directoryPath: string): number => {
  if (!fs.existsSync(directoryPath)) {
    return 0
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
  let total = 0

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name)
    const stat = fs.lstatSync(fullPath)

    if (stat.isDirectory()) {
      total += getDirectorySize(fullPath)
      continue
    }

    if (stat.isFile()) {
      total += stat.size
    }
  }

  return total
}

const getAppsForUser = (username: string): string[] => {
  const appsFile = appsFileCandidates.find((candidate) => fs.existsSync(candidate))
  if (!appsFile) {
    return []
  }

  const raw = fs.readFileSync(appsFile, 'utf8')
  const payload = JSON.parse(raw) as Record<string, AppDefinition>

  return Object.values(payload)
    .filter((app) => Array.isArray(app.users) && app.users.includes(username))
    .map((app) => app.name)
}

export const enrichMembersWithLocalStats = (members: AuthMemberRecord[]): EnrichedMemberRecord[] =>
  members.map((member) => {
    const totalStorageBytes = getDirectorySize(getUserHomePath(member.username))
    const usagePercent = Number(((totalStorageBytes / USER_STORAGE_LIMIT_BYTES) * 100).toFixed(2))

    return {
      ...member,
      apps: getAppsForUser(member.username),
      totalStorageBytes,
      totalStorageMB: Number((totalStorageBytes / (1024 * 1024)).toFixed(2)),
      usagePercent,
    }
  })

export const getMemberStorageLimitBytes = (): number => USER_STORAGE_LIMIT_BYTES
