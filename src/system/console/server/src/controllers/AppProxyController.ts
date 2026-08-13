import type { Request, Response } from 'express'
import http from 'node:http'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { resolveUserPorts } from '../lib/PortResolver.js'
import { loadServiceDefinition } from '../services/ServiceRegistry.js'
import { resolveAppGatewayPort } from '../services/AppRouteService.js'

const resolveProxyTarget = (username: string, appKey: string): number | null => {
  const cached = resolveAppGatewayPort(appKey, username)
  if (cached) {
    return cached
  }

  try {
    const service = loadServiceDefinition(appKey)
    const { runtime } = resolveUserPorts(service, username)
    if (typeof runtime.http === 'number') {
      return runtime.http
    }

    const values = Object.values(runtime)
    return values.length > 0 ? values[0]! : null
  } catch {
    return null
  }
}

export const appProxyHandler = (req: Request, res: Response): void => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  const appKey = String(req.params.appKey ?? '')

  if (!username || !appKey) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const port = resolveProxyTarget(username, appKey)
  if (!port) {
    res.status(502).json({ error: 'No upstream port configured for this app' })
    return
  }

  const mountPrefix = `/apps/${appKey}/proxy`
  const upstreamPath = req.originalUrl.startsWith(mountPrefix)
    ? req.originalUrl.slice(mountPrefix.length) || '/'
    : req.url || '/'

  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      method: req.method,
      path: upstreamPath,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${port}`,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', (error) => {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Unable to reach app upstream',
        detail: error.message,
      })
    }
  })

  req.pipe(upstream)
}
