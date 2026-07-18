import type { NextFunction, Request, Response } from 'express'

export type AuthRole = 'Admin' | 'Guest'

export interface AuthenticatedUser {
  id: string
  username: string
  role: AuthRole
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    id?: string
    username?: string
    role?: AuthRole
  }
  authUser?: AuthenticatedUser
  session: Request['session'] & {
    user?: AuthenticatedUser
  }
}

const toAuthUser = (req: AuthenticatedRequest): AuthenticatedUser | null => {
  if (req.auth?.id && req.auth.username && req.auth.role) {
    return {
      id: req.auth.id,
      username: req.auth.username,
      role: req.auth.role,
    }
  }

  if (req.session?.user) {
    return req.session.user
  }

  return null
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const typedReq = req as AuthenticatedRequest
  const user = toAuthUser(typedReq)

  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  typedReq.authUser = user
  next()
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const typedReq = req as AuthenticatedRequest
  const user = typedReq.authUser ?? toAuthUser(typedReq)

  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (user.role !== 'Admin') {
    res.status(403).json({ error: 'Admin privileges required' })
    return
  }

  typedReq.authUser = user
  next()
}

declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser
  }
}
