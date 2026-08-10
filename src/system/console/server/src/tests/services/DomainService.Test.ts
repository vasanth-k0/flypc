import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import {
  buildPublicHost,
  getDomainConfig,
  getDomainStatus,
  renderCaddyfile,
  updateDomainConfig,
  writeCaddyfile,
  type RHostDomainConfig,
} from '../../services/DomainService.js'
import { readBlueprint, writeBlueprint } from '../../controllers/TenantStorage.js'

type EnvSnapshot = Record<string, string | undefined>

const blueprintPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../../db/store/system-blueprint.json',
)

describe('DomainService', () => {
  let tempRoot = ''
  let envSnapshot: EnvSnapshot = {}
  let blueprintBackup = ''

  beforeEach(() => {
    envSnapshot = {
      RHOST_DATA_ROOT: process.env.RHOST_DATA_ROOT,
      CADDYFILE_PATH: process.env.CADDYFILE_PATH,
      RHOST_UPSTREAM: process.env.RHOST_UPSTREAM,
    }

    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-domain-'))
    const dataRoot = path.join(tempRoot, 'data')
    process.env.RHOST_DATA_ROOT = dataRoot
    process.env.CADDYFILE_PATH = path.join(dataRoot, 'caddy', 'Caddyfile')
    process.env.RHOST_UPSTREAM = 'rhost:3000'

    if (fs.existsSync(blueprintPath)) {
      blueprintBackup = fs.readFileSync(blueprintPath, 'utf8')
    }

    writeBlueprint({
      name: 'Mr. User',
      colorPalette: 'Grey • Blue',
      ui: 'dashboard',
      controlsSide: 'right',
      gotoConsole: true,
      defaultApp: 'coderun-lite',
      wallp: 1,
      containerProgram: 'docker',
      rhostDomain: {
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
      },
    })
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (blueprintBackup) {
      fs.writeFileSync(blueprintPath, blueprintBackup, 'utf8')
    }
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  it('defaults brand owner to flypc and localhost internal SSL', () => {
    const config = getDomainConfig()
    expect(config.brandOwner).toBe('flypc')
    expect(config.baseDomain).toBe('localhost')
    expect(config.sslMode).toBe('internal')
    expect(buildPublicHost(config)).toBe('localhost')
  })

  it('builds primary node host as slug.baseDomain', () => {
    expect(
      buildPublicHost({
        brandOwner: 'flypc',
        baseDomain: 'flypc.in',
        accountSlug: 'vk',
        nodeRole: 'primary',
        nodeId: '',
      }),
    ).toBe('vk.flypc.in')
  })

  it('renders internal Caddy profile for localhost', () => {
    const config: RHostDomainConfig = {
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
      sslMessage: '',
      httpsEnabled: true,
      initialSetupComplete: false,
    }

    expect(renderCaddyfile(config)).toContain('tls internal')
    expect(renderCaddyfile(config)).toContain('reverse_proxy rhost:3000')
  })

  it('writes internal Caddy profile and completes initial desktop setup', () => {
    const blueprint = readBlueprint()
    blueprint.ui = 'dashboard'
    writeBlueprint(blueprint)

    updateDomainConfig({ completeInitialSetup: true })

    const status = getDomainStatus()
    expect(status.initialSetupComplete).toBe(true)
    expect(status.sslStatus).toBe('active')
    expect(status.httpsUrl).toBe('https://localhost')
    expect(fs.existsSync(status.caddyfilePath)).toBe(true)
    expect(fs.readFileSync(status.caddyfilePath, 'utf8')).toContain('tls internal')

    const updatedBlueprint = readBlueprint()
    expect(updatedBlueprint.ui).toBe('desktop')
  })

  it('writes letsencrypt Caddy profile for public domains', () => {
    updateDomainConfig({
      baseDomain: 'flypc.in',
      accountSlug: 'vk',
      nodeRole: 'primary',
      sslMode: 'letsencrypt',
      adminEmail: 'admin@flypc.in',
      completeInitialSetup: true,
    })

    const status = getDomainStatus()
    expect(status.publicHost).toBe('vk.flypc.in')
    expect(fs.readFileSync(status.caddyfilePath, 'utf8')).toContain('email admin@flypc.in')
  })

  it('persists Caddy profile via writeCaddyfile', () => {
    const config = getDomainConfig()
    const target = writeCaddyfile(config)
    expect(fs.existsSync(target)).toBe(true)
  })
})
