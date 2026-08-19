import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import { UniqueConstraintError, ValidationError } from 'sequelize'
import { UserModel } from '../../db/models/User.model.js'
import {
  ensureUserAppsStorageOnLogin,
  getUserHomePath,
  provisionUserStorage,
  removeUserStorage,
} from '../storage/TenantStorage.js'
import {
  enrichMembersWithLocalStats,
  getMemberStorageLimitBytes,
  type AuthMemberRecord,
} from '../MemberStatsService.js'

const jwtSecret = process.env.JWT_SECRET ?? 'flypc-jwt-secret'

export type SanitizedUser = {
  id: string
  username: string
  role: 'Admin' | 'Guest'
}

export type AuthSessionUser = SanitizedUser

const isValidUsername = (value: string): boolean => /^[a-zA-Z0-9]{1,64}$/.test(value)

const sanitizeUser = (user: UserModel): SanitizedUser => ({
  id: user.id,
  username: user.username,
  role: user.role,
})

export const issueAuthToken = (user: UserModel): string =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '12h' },
  )

export class UserService {
  async registerUser(username: string, password: string): Promise<SanitizedUser> {
    if (!isValidUsername(username)) {
      throw new UserServiceError('username must be alphanumeric and 1-64 chars long', 400)
    }

    if (password.length < 8) {
      throw new UserServiceError('password must be at least 8 characters long', 400)
    }

    const existing = await UserModel.findOne({ where: { username } })
    if (existing) {
      throw new UserServiceError('Username already exists', 409)
    }

    let createdUser: UserModel | null = null

    try {
      const passwordHash = await bcrypt.hash(password, 10)
      createdUser = await UserModel.create({
        username,
        password: passwordHash,
        role: 'Guest',
      })

      provisionUserStorage(username)
      ensureUserAppsStorageOnLogin(username)

      return sanitizeUser(createdUser)
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

      if (error instanceof UserServiceError) {
        throw error
      }

      if (error instanceof UniqueConstraintError) {
        throw new UserServiceError('Username already exists', 409)
      }

      if (error instanceof ValidationError) {
        throw new UserServiceError(
          `Validation failed: ${error.errors.map((issue) => issue.message).join(', ')}`,
          400,
        )
      }

      throw error
    }
  }

  async loginUser(username: string, password: string): Promise<{ token: string; user: SanitizedUser }> {
    const user = await UserModel.findOne({ where: { username } })
    if (!user) {
      throw new UserServiceError('Invalid credentials', 401)
    }

    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new UserServiceError('Invalid credentials', 401)
    }

    ensureUserAppsStorageOnLogin(user.username)

    return {
      token: issueAuthToken(user),
      user: sanitizeUser(user),
    }
  }

  async getUserById(userId: string): Promise<SanitizedUser> {
    const user = await UserModel.findByPk(userId)
    if (!user) {
      throw new UserServiceError('User not found', 404)
    }

    return sanitizeUser(user)
  }

  async changeUserName(userId: string, newUsername: string): Promise<{ token: string; user: SanitizedUser }> {
    if (!isValidUsername(newUsername)) {
      throw new UserServiceError('newUsername must be alphanumeric and 1-64 chars long', 400)
    }

    const existing = await UserModel.findOne({ where: { username: newUsername } })
    if (existing) {
      throw new UserServiceError('Username already exists', 409)
    }

    const user = await UserModel.findByPk(userId)
    if (!user) {
      throw new UserServiceError('User not found', 404)
    }

    const oldHomePath = getUserHomePath(user.username)
    const newHomePath = getUserHomePath(newUsername)

    if (fs.existsSync(oldHomePath) && !fs.existsSync(newHomePath)) {
      fs.renameSync(oldHomePath, newHomePath)
    }

    user.username = newUsername
    await user.save()

    return {
      token: issueAuthToken(user),
      user: sanitizeUser(user),
    }
  }

  async resetUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      throw new UserServiceError('currentPassword and newPassword(>=8 chars) are required', 400)
    }

    const user = await UserModel.findByPk(userId)
    if (!user) {
      throw new UserServiceError('User not found', 404)
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      throw new UserServiceError('Invalid current password', 401)
    }

    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
  }

  async listMembers(): Promise<{ limitBytes: number; members: ReturnType<typeof enrichMembersWithLocalStats> }> {
    const users = await UserModel.findAll({ order: [['createdAt', 'ASC']] })
    const members = enrichMembersWithLocalStats(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      })) satisfies AuthMemberRecord[],
    )

    return {
      limitBytes: getMemberStorageLimitBytes(),
      members,
    }
  }

  async removeUser(input: { username?: string; id?: string }, actor?: AuthSessionUser | null): Promise<SanitizedUser> {
    if (!input.username && !input.id) {
      throw new UserServiceError('username or id is required', 400)
    }

    const user = await UserModel.findOne({ where: input.username ? { username: input.username } : { id: input.id } })
    if (!user) {
      throw new UserServiceError('User not found', 404)
    }

    const isSelfDelete = actor?.id === user.id
    if (actor?.role !== 'Admin' && !isSelfDelete) {
      throw new UserServiceError('Only admins can remove other users', 403)
    }

    if (user.username === 'admin' && actor?.role !== 'Admin') {
      throw new UserServiceError('Admin account can only be removed by admin', 403)
    }

    const removed = sanitizeUser(user)
    await user.destroy()
    removeUserStorage(user.username)

    return removed
  }
}

export class UserServiceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'UserServiceError'
    this.statusCode = statusCode
  }
}

export const userService = new UserService()
