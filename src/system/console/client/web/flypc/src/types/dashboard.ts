export type AppEntry = {
  key: string
  name: string
  icon: string
  description?: string
  published: boolean
  users: string[]
}

export type WindowId = 'apps' | 'monitor' | 'files' | 'terminal' | 'settings' | 'accounts' | 'members' | `app:${string}`

export type AuthUser = {
  id: string
  username: string
  role: 'Admin' | 'Guest'
}

export type MemberSummary = {
  id: string
  username: string
  role: 'Admin' | 'Guest'
  createdAt: string
  apps?: string[]
  totalStorageBytes?: number
  totalStorageMB?: number
  usagePercent?: number
}
