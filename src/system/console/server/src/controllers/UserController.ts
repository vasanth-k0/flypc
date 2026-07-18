import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UniqueConstraintError, ValidationError } from 'sequelize'
import { UserModel } from '../db/models/User.model.js'
import { getUserHomePath, removeUserStorage, provisionUserStorage } from './TenantStorage.js'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'

const jwtSecret = process.env.JWT_SECRET ?? 'flypc-jwt-secret'
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

const isValidUsername = (value: string): boolean => /^[a-zA-Z0-9]{1,64}$/.test(value)

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

const issueAuthToken = (user: UserModel): string =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '12h' }
  )

const sanitizeUser = (user: UserModel): Record<string, unknown> => ({
  id: user.id,
  username: user.username,
  role: user.role,
})

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string }

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' })
    return
  }

  if (!isValidUsername(username)) {
    res.status(400).json({ error: 'username must be alphanumeric and 1-64 chars long' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'password must be at least 8 characters long' })
    return
  }

  let createdUser: UserModel | null = null

  try {
    const existing = await UserModel.findOne({ where: { username } })
    if (existing) {
      res.status(409).json({ error: 'Username already exists' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    createdUser = await UserModel.create({
      username,
      password: passwordHash,
      role: 'Guest',
    })

    provisionUserStorage(username)

    res.status(201).json({ ok: true, user: sanitizeUser(createdUser) })
  } catch (error) {
    if (createdUser) {
      try {
        await createdUser.destroy()
      } catch {
        // Ignore cleanup failure and return the original registration error.
      }

      try {
        removeUserStorage(username)
      } catch {
        // Ignore storage cleanup failures during rollback.
      }
    }

    if (error instanceof UniqueConstraintError) {
      res.status(409).json({ error: 'Username already exists' })
      return
    }

    if (error instanceof ValidationError) {
      res.status(400).json({
        error: 'Validation failed',
        detail: error.errors.map((issue) => issue.message).join(', '),
      })
      return
    }

    res.status(500).json({
      error: 'Unable to register user',
      detail: error instanceof Error ? error.message : String(error),
    })
    return
  }
}

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string }

  const user = await UserModel.findOne({ where: { username } })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = issueAuthToken(user)

  const typedReq = req as AuthenticatedRequest
  typedReq.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  }

  res.json({ ok: true, token, user: sanitizeUser(user) })
}

export const getAuthenticatedUser = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const user = await UserModel.findByPk(authUser.id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({ ok: true, user: sanitizeUser(user) })
}

export const changeUserName = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser
  const { newUsername } = req.body as { newUsername?: string }

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!newUsername || !isValidUsername(newUsername)) {
    res.status(400).json({ error: 'newUsername must be alphanumeric and 1-64 chars long' })
    return
  }

  const existing = await UserModel.findOne({ where: { username: newUsername } })
  if (existing) {
    res.status(409).json({ error: 'Username already exists' })
    return
  }

  const user = await UserModel.findByPk(authUser.id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const oldHomePath = getUserHomePath(user.username)
  const newHomePath = getUserHomePath(newUsername)

  if (fs.existsSync(oldHomePath) && !fs.existsSync(newHomePath)) {
    fs.renameSync(oldHomePath, newHomePath)
  }

  user.username = newUsername
  await user.save()

  typedReq.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  }

  const token = issueAuthToken(user)
  res.json({ ok: true, token, user: sanitizeUser(user) })
}

export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'currentPassword and newPassword(>=8 chars) are required' })
    return
  }

  const user = await UserModel.findByPk(authUser.id)
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const isValidPassword = await bcrypt.compare(currentPassword, user.password)
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid current password' })
    return
  }

  user.password = await bcrypt.hash(newPassword, 10)
  await user.save()

  res.json({ ok: true })
}

export const getMembers = async (_req: Request, res: Response): Promise<void> => {
  const users = await UserModel.findAll({ order: [['createdAt', 'ASC']] })

  const members = users.map((user) => {
    const totalStorageBytes = getDirectorySize(getUserHomePath(user.username))
    const usagePercent = Number(((totalStorageBytes / USER_STORAGE_LIMIT_BYTES) * 100).toFixed(2))

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      apps: getAppsForUser(user.username),
      totalStorageBytes,
      totalStorageMB: Number((totalStorageBytes / (1024 * 1024)).toFixed(2)),
      usagePercent,
    }
  })

  res.json({ ok: true, limitBytes: USER_STORAGE_LIMIT_BYTES, members })
}

export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  await new Promise<void>((resolve) => {
    typedReq.session.destroy(() => resolve())
  })

  res.json({ ok: true })
}

export const removeUser = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const actor = typedReq.authUser
  const { username, id } = req.body as { username?: string; id?: string }

  if (!username && !id) {
    res.status(400).json({ error: 'username or id is required' })
    return
  }

  const user = await UserModel.findOne({ where: username ? { username } : { id } })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const isSelfDelete = actor?.id === user.id
  if (actor?.role !== 'Admin' && !isSelfDelete) {
    res.status(403).json({ error: 'Only admins can remove other users' })
    return
  }

  if (user.username === 'admin' && actor?.role !== 'Admin') {
    res.status(403).json({ error: 'Admin account can only be removed by admin' })
    return
  }

  await user.destroy()
  removeUserStorage(user.username)

  res.json({ ok: true, removed: sanitizeUser(user) })
}
