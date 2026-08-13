import fs from 'node:fs'
import path from 'node:path'
import { readBlueprint, writeBlueprint } from './storage/TenantStorage.js'
import { loadAppGatewayRoutes, renderAppGatewayCaddyBlocks } from './AppRouteService.js'

export type RHostNodeRole = 'hub' | 'primary' | 'branch' | 'standalone'
export type RHostSslMode = 'internal' | 'letsencrypt' | 'manual'

export type RHostDomainConfig = {
  brandOwner: string
  productName: string
  baseDomain: string
  accountSlug: string
  nodeRole: RHostNodeRole
  nodeId: string
  publicHost: string
  adminEmail: string
  sslMode: RHostSslMode
  sslStatus: 'pending' | 'active' | 'error'
  sslMessage: string
  httpsEnabled: boolean
  initialSetupComplete: boolean
}

const defaultDomainConfig: RHostDomainConfig = {
  brandOwner: 'flypc',
  productName: 'RHost',
  baseDomain: 'localhost',
  accountSlug: 'demo',
  nodeRole: 'standalone',
  nodeId: '',
  publicHost: 'localhost',
  adminEmail: 'admin@flypc.in',
  sslMode: 'internal',
  sslStatus: 'pending',
  sslMessage: 'HTTPS not configured yet',
  httpsEnabled: true,
  initialSetupComplete: false,
}

const getDataRoot = (): string =>
  process.env.RHOST_DATA_ROOT
    ? path.resolve(process.env.RHOST_DATA_ROOT)
    : path.resolve(process.cwd(), '../../../../data/rhost')

export const getCaddyfilePath = (): string =>
  process.env.CADDYFILE_PATH ?? path.join(getDataRoot(), 'caddy', 'Caddyfile')

const sanitizeSlug = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')

export const buildPublicHost = (config: Pick<RHostDomainConfig, 'baseDomain' | 'accountSlug' | 'nodeRole' | 'nodeId' | 'brandOwner'>): string => {
  const base = config.baseDomain.trim().toLowerCase()
  const slug = sanitizeSlug(config.accountSlug)

  if (base === 'localhost' || base === '127.0.0.1') {
    return 'localhost'
  }

  if (config.nodeRole === 'hub') {
    return `www.${base}`
  }

  if (config.nodeRole === 'branch' && config.nodeId.trim()) {
    return `${config.nodeId.trim()}.${slug}.${base}`
  }

  if (config.nodeRole === 'primary' && slug) {
    return `${slug}.${base}`
  }

  return base
}

const normalizeDomainConfig = (raw: Record<string, unknown>): RHostDomainConfig => {
  const merged = {
    ...defaultDomainConfig,
    ...raw,
    brandOwner: typeof raw.brandOwner === 'string' && raw.brandOwner.trim() ? raw.brandOwner.trim() : defaultDomainConfig.brandOwner,
    productName: typeof raw.productName === 'string' && raw.productName.trim() ? raw.productName.trim() : defaultDomainConfig.productName,
    baseDomain: typeof raw.baseDomain === 'string' && raw.baseDomain.trim() ? raw.baseDomain.trim().toLowerCase() : defaultDomainConfig.baseDomain,
    accountSlug: typeof raw.accountSlug === 'string' ? sanitizeSlug(raw.accountSlug) : defaultDomainConfig.accountSlug,
    nodeRole: (['hub', 'primary', 'branch', 'standalone'] as const).includes(raw.nodeRole as RHostNodeRole)
      ? (raw.nodeRole as RHostNodeRole)
      : defaultDomainConfig.nodeRole,
    nodeId: typeof raw.nodeId === 'string' ? raw.nodeId.trim() : defaultDomainConfig.nodeId,
    adminEmail: typeof raw.adminEmail === 'string' && raw.adminEmail.includes('@')
      ? raw.adminEmail.trim()
      : defaultDomainConfig.adminEmail,
    sslMode: (['internal', 'letsencrypt', 'manual'] as const).includes(raw.sslMode as RHostSslMode)
      ? (raw.sslMode as RHostSslMode)
      : defaultDomainConfig.sslMode,
    sslStatus: (['pending', 'active', 'error'] as const).includes(raw.sslStatus as RHostDomainConfig['sslStatus'])
      ? (raw.sslStatus as RHostDomainConfig['sslStatus'])
      : defaultDomainConfig.sslStatus,
    sslMessage: typeof raw.sslMessage === 'string' ? raw.sslMessage : defaultDomainConfig.sslMessage,
    httpsEnabled: raw.httpsEnabled !== false,
    initialSetupComplete: raw.initialSetupComplete === true,
  }

  const publicHost = buildPublicHost(merged)

  const sslMode: RHostSslMode =
    publicHost === 'localhost' || publicHost.endsWith('.local')
      ? 'internal'
      : merged.sslMode

  return {
    ...merged,
    publicHost,
    sslMode,
  }
}

export const getDomainConfig = (): RHostDomainConfig => {
  const blueprint = readBlueprint()
  return normalizeDomainConfig(blueprint.rhostDomain as Record<string, unknown> ?? {})
}

export const renderCaddyfile = (config: RHostDomainConfig): string => {
  const upstream = process.env.RHOST_UPSTREAM ?? 'rhost:3000'
  const host = config.publicHost
  const appRoutesBlock = renderAppGatewayCaddyBlocks(loadAppGatewayRoutes())

  const gatewayRoutes = `  route {
    handle /gateway/* {
      root * /srv/boot
      uri strip_prefix /gateway
      try_files {path} /index.html
      file_server
    }

    handle /gateway {
      root * /srv/boot
      rewrite * /index.html
      file_server
    }

    handle /boot* {
      redir /gateway permanent
    }

${appRoutesBlock ? `${appRoutesBlock}\n\n` : ''}    handle /console* {
      uri strip_prefix /console
      reverse_proxy ${upstream}
    }

    handle {
      reverse_proxy ${upstream} {
        health_uri /system/health
        health_interval 10s
        health_timeout 5s
        fail_duration 15s
      }
    }
  }

  handle_errors {
    @upstream_down expression \`{http.error.status_code} == 502 || {http.error.status_code} == 503\`
    handle @upstream_down {
      @not_console not path /console /console/*
      handle @not_console {
        rewrite * /index.html
        root * /srv/boot
        file_server
      }
    }
  }`

  if (!config.httpsEnabled) {
    return `# RHost gateway HTTP profile\n${host} {\n${gatewayRoutes}\n}\n`
  }

  if (config.sslMode === 'internal' || host === 'localhost') {
    return `# RHost gateway local HTTPS\n${host} {\n  tls internal\n${gatewayRoutes}\n}\n`
  }

  if (config.sslMode === 'letsencrypt') {
    return `# RHost gateway Let's Encrypt\n${host} {\n  email ${config.adminEmail}\n${gatewayRoutes}\n}\n`
  }

  return `# RHost gateway manual TLS\n${host} {\n${gatewayRoutes}\n}\n`
}

export const writeCaddyfile = (config: RHostDomainConfig): string => {
  const target = getCaddyfilePath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const contents = renderCaddyfile(config)
  fs.writeFileSync(target, contents, 'utf8')
  return target
}

export const updateDomainConfig = (
  patch: Partial<RHostDomainConfig> & { completeInitialSetup?: boolean },
): RHostDomainConfig => {
  const blueprint = readBlueprint()
  const current = normalizeDomainConfig(blueprint.rhostDomain as Record<string, unknown> ?? {})
  const next = normalizeDomainConfig({
    ...current,
    ...patch,
    initialSetupComplete: patch.completeInitialSetup ? true : patch.initialSetupComplete ?? current.initialSetupComplete,
  })

  if (patch.completeInitialSetup) {
    blueprint.ui = 'desktop'
    next.sslStatus = 'active'
    next.sslMessage = next.sslMode === 'internal'
      ? 'Local HTTPS enabled with internal certificate (https://localhost)'
      : `Let's Encrypt profile written for ${next.publicHost}`
  }

  blueprint.rhostDomain = next
  writeBlueprint(blueprint)

  if (next.httpsEnabled) {
    writeCaddyfile(next)
  }

  return next
}

export const getDomainStatus = (): RHostDomainConfig & { caddyfilePath: string; httpsUrl: string } => {
  const config = getDomainConfig()
  const httpsUrl = config.httpsEnabled ? `https://${config.publicHost}` : `http://${config.publicHost}`
  return {
    ...config,
    caddyfilePath: getCaddyfilePath(),
    httpsUrl,
  }
}
