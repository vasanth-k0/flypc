import type { NextFunction, Request, Response } from 'express'
import type { AuthenticatedRequest } from './auth.middleware.js'

export const getRealUsername = (req: Request): string | null => {
  const username = (req as AuthenticatedRequest).authUser?.username
  if (!username || username === 'guest') {
    return null
  }
  return username
}

export const requireRealUser = (req: Request, res: Response, next: NextFunction): void => {
  const username = getRealUsername(req)
  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  next()
}
