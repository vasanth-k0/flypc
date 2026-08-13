import fs from 'node:fs'
import path from 'node:path'
import { getDomainConfig, writeCaddyfile } from './DomainService.js'

const getDataRoot = (): string =>
  process.env.RHOST_DATA_ROOT
    ? path.resolve(process.env.RHOST_DATA_ROOT)
    : path.resolve(process.cwd(), '../../../../data/rhost')

export type AppGatewayRoute = {
  appKey: string
  username: string
  port: number
  updatedAt: string
}

const routesFile = (): string => path.join(getDataRoot(), 'caddy', 'app-routes.json')

const loadRoutesFile = (): AppGatewayRoute[] => {
  const filePath = routesFile()
  if (!fs.existsSync(filePath)) {
    return []
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AppGatewayRoute[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveRoutesFile = (routes: AppGatewayRoute[]): void => {
  const filePath = routesFile()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(routes, null, 2)}\n`, 'utf8')
}

export const loadAppGatewayRoutes = (): AppGatewayRoute[] => loadRoutesFile()

export const registerAppGatewayRoute = (
  appKey: string,
  username: string,
  port: number,
): AppGatewayRoute => {
  const routes = loadRoutesFile().filter(
    (entry) => !(entry.appKey === appKey && entry.username === username),
  )
  const next: AppGatewayRoute = {
    appKey,
    username,
    port,
    updatedAt: new Date().toISOString(),
  }
  routes.push(next)
  saveRoutesFile(routes)
  return next
}

export const removeAppGatewayRoute = (appKey: string, username: string): void => {
  const routes = loadRoutesFile().filter(
    (entry) => !(entry.appKey === appKey && entry.username === username),
  )
  saveRoutesFile(routes)
}

export const resolveAppGatewayPort = (appKey: string, username: string): number | null => {
  const route = loadRoutesFile().find(
    (entry) => entry.appKey === appKey && entry.username === username,
  )
  return route?.port ?? null
}

/** Same-origin proxy path used by the console iframe. */
export const buildAppProxyPath = (appKey: string): string => `/apps/${appKey}/proxy/`

/** Public gateway path via Caddy: https://host/appKey/ */
export const buildAppGatewayPath = (appKey: string): string => `/${appKey}/`

export const renderAppGatewayCaddyBlocks = (routes: AppGatewayRoute[]): string => {
  const upstreamHost = process.env.APP_UPSTREAM_HOST ?? 'host.docker.internal'
  const uniqueByApp = new Map<string, AppGatewayRoute>()

  for (const route of routes) {
    const existing = uniqueByApp.get(route.appKey)
    if (!existing || route.updatedAt > existing.updatedAt) {
      uniqueByApp.set(route.appKey, route)
    }
  }

  const blocks: string[] = []
  for (const route of uniqueByApp.values()) {
    blocks.push(`    handle /${route.appKey}/* {
      uri strip_prefix /${route.appKey}
      reverse_proxy ${upstreamHost}:${route.port}
    }

    handle /${route.appKey} {
      redir /${route.appKey}/ permanent
    }`)
  }

  return blocks.join('\n\n')
}

export const syncAppRoutesToCaddy = (): void => {
  try {
    const config = getDomainConfig()
    writeCaddyfile(config)
  } catch (error) {
    console.warn('[app-routes]: Unable to sync Caddy profile', error)
  }
}

export const registerAppGatewayRouteAndSync = (
  appKey: string,
  username: string,
  port: number,
): AppGatewayRoute => {
  const route = registerAppGatewayRoute(appKey, username, port)
  syncAppRoutesToCaddy()
  return route
}
