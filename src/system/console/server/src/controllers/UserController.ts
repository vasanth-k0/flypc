import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { userService, UserServiceError } from '../services/auth/UserService.js'

const handleServiceError = (res: Response, error: unknown): void => {
  if (error instanceof UserServiceError) {
    res.status(error.statusCode).json({ error: error.message })
    return
  }

  res.status(500).json({
    error: 'Unexpected user service error',
    detail: error instanceof Error ? error.message : String(error),
  })
}

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string }

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' })
    return
  }

  try {
    const user = await userService.registerUser(username, password)
    res.status(201).json({ ok: true, user })
  } catch (error) {
    handleServiceError(res, error)
  }
}

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string }

  try {
    const result = await userService.loginUser(username, password)
    const typedReq = req as AuthenticatedRequest
    typedReq.session.user = result.user
    res.json({ ok: true, token: result.token, user: result.user })
  } catch (error) {
    handleServiceError(res, error)
  }
}

export const getAuthenticatedUser = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const user = await userService.getUserById(authUser.id)
    res.json({ ok: true, user })
  } catch (error) {
    handleServiceError(res, error)
  }
}

export const changeUserName = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser
  const { newUsername } = req.body as { newUsername?: string }

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const result = await userService.changeUserName(authUser.id, newUsername ?? '')
    typedReq.session.user = result.user
    res.json({ ok: true, token: result.token, user: result.user })
  } catch (error) {
    handleServiceError(res, error)
  }
}

export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  const typedReq = req as AuthenticatedRequest
  const authUser = typedReq.authUser
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    await userService.resetUserPassword(authUser.id, currentPassword ?? '', newPassword ?? '')
    res.json({ ok: true })
  } catch (error) {
    handleServiceError(res, error)
  }
}

export const getMembers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await userService.listMembers()
    res.json({ ok: true, ...result })
  } catch (error) {
    handleServiceError(res, error)
  }
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

  try {
    const payload: { username?: string; id?: string } = {}
    if (username !== undefined) payload.username = username
    if (id !== undefined) payload.id = id
    const removed = await userService.removeUser(payload, actor)
    res.json({ ok: true, removed })
  } catch (error) {
    handleServiceError(res, error)
  }
}
