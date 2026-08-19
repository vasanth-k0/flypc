import fs from 'node:fs'
import type { NextFunction, Request, Response } from 'express'
import { resolveAuthUser, type AuthenticatedRequest, type AuthenticatedUser } from './auth.middleware.js'

type AppDefinition = {
  name: string
  icon: string
  published: boolean
  users: string[]
}

type AppListItem = AppDefinition & { key: string }

type AccessibleAppsResponse = Response<unknown, { accessibleApps?: AppListItem[] }>

const guestUser: AuthenticatedUser = {
  id: 'guest',
  username: 'guest',
  role: 'Guest',
}

const loadApps = (appsFile: string): Record<string, AppDefinition> =>
  JSON.parse(fs.readFileSync(appsFile, 'utf8')) as Record<string, AppDefinition>

const canAccessApp = (app: AppDefinition, username: string): boolean =>
  app.published && app.users.includes(username)

/** Resolves the signed-in user, or applies the restricted built-in guest identity. */
export const resolveAppUser = (req: Request, _res: Response, next: NextFunction): void => {
  const typedReq = req as AuthenticatedRequest
  typedReq.authUser = resolveAuthUser(typedReq) ?? guestUser
  next()
}

/** Filters the app catalog to published applications explicitly assigned to the current user. */
export const filterAccessibleApps = (appsFile: string) =>
  (req: Request, res: AccessibleAppsResponse, next: NextFunction): void => {
    try {
      const username = (req as AuthenticatedRequest).authUser?.username
      if (!username) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }

      res.locals.accessibleApps = Object.entries(loadApps(appsFile))
        .filter(([, app]) => canAccessApp(app, username))
        .map(([key, app]) => ({ key, ...app }))
      next()
    } catch (error) {
      res.status(500).json({
        error: 'Unable to read apps list',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }

/** Blocks app operations unless the published app is explicitly assigned to the current user. */
export const requireAppAccess = (appsFile: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const username = (req as AuthenticatedRequest).authUser?.username
      const appKey = String(req.params.appKey ?? '')
      const app = loadApps(appsFile)[appKey]

      if (!app) {
        res.status(404).json({ error: 'Application not found' })
        return
      }

      if (!username || !canAccessApp(app, username)) {
        res.status(403).json({ error: 'You do not have access to this application' })
        return
      }

      next()
    } catch (error) {
      res.status(500).json({
        error: 'Unable to authorize application access',
        detail: error instanceof Error ? error.message : String(error),
      })
    }
  }
