import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

type EnvSnapshot = Record<string, string | undefined>

describe('ApexService', () => {
  let tempRoot = ''
  let envSnapshot: EnvSnapshot = {}

  beforeEach(() => {
    envSnapshot = {
      FLYPC_ROOT: process.env.FLYPC_ROOT,
      APP_METADATA_ROOT: process.env.APP_METADATA_ROOT,
      APP_STORAGE_ROOT: process.env.APP_STORAGE_ROOT,
      APEX_SKIP_IMAGE_PULL: process.env.APEX_SKIP_IMAGE_PULL,
    }
    process.env.APEX_SKIP_IMAGE_PULL = 'true'
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  const setupTempStore = (): void => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-apex-'))
    const metadataRoot = path.join(tempRoot, 'server/app')
    const catalogAppDir = path.join(tempRoot, 'src/apps/apex/catalog/jellyfin')
    const markerView = path.join(tempRoot, 'src/apps/coderun-lite/view')

    fs.mkdirSync(metadataRoot, { recursive: true })
    fs.mkdirSync(catalogAppDir, { recursive: true })
    fs.mkdirSync(markerView, { recursive: true })
    fs.writeFileSync(path.join(markerView, 'index.html'), '<!doctype html><title>coderun-lite</title>')
    fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ name: 'flypc-monorepo' }))
    fs.writeFileSync(path.join(metadataRoot, 'apps.json'), '{}\n')
    fs.writeFileSync(
      path.join(catalogAppDir, 'manifest.json'),
      JSON.stringify(
        {
          name: 'Jellyfin',
          icon: 'PlayCircleFilled',
          description: 'Media server',
          portDefaults: { admin: 7187 },
        },
        null,
        2,
      ),
    )
    fs.writeFileSync(
      path.join(catalogAppDir, 'service.json'),
      JSON.stringify(
        {
          type: 'daemon',
          dir: 'src/apps/jellyfin',
          image: 'jellyfin/jellyfin:latest',
          storageMount: '/config',
          mounts: ['data', 'config'],
          ports: { http: 8096 },
        },
        null,
        2,
      ),
    )
    fs.writeFileSync(path.join(catalogAppDir, 'about.md'), '# Jellyfin\n\nMedia server app.\n')

    process.env.FLYPC_ROOT = tempRoot
    process.env.APP_METADATA_ROOT = metadataRoot
    process.env.APP_STORAGE_ROOT = path.join(tempRoot, 'storage')
  }

  it('lists jellyfin and plex in the Apex catalog', async () => {
    delete process.env.FLYPC_ROOT
    delete process.env.APP_METADATA_ROOT
    delete process.env.APP_STORAGE_ROOT

    const { apexService } = await import('../../services/ApexService.js')
    const apps = apexService.listStoreApps('admin').filter((app) => ['jellyfin', 'plex'].includes(app.key))

    expect(apps).toHaveLength(2)
    expect(apps.map((app) => app.name)).toEqual(expect.arrayContaining(['Jellyfin', 'Plex']))
    expect(apps.every((app) => app.hasContainerImage)).toBe(true)
  })

  it('installs a catalog app for the current user', async () => {
    setupTempStore()
    const { apexService } = await import('../../services/ApexService.js')
    const { loadAppsCatalog } = await import('../../services/AppsCatalog.js')
    const { readInstalledServiceDefinition } = await import('../../lib/ApexCatalog.js')
    const { getUserAppStoragePath } = await import('../../controllers/TenantStorage.js')

    const installed = await apexService.installApp('admin', 'jellyfin')

    expect(installed.installed).toBe(true)
    expect(loadAppsCatalog().jellyfin?.users).toContain('admin')
    expect(readInstalledServiceDefinition('jellyfin')?.ports?.users?.admin).toBe(7187)
    expect(fs.existsSync(getUserAppStoragePath('admin', 'jellyfin'))).toBe(true)
  })

  it('records dependency metadata for catalog apps like open-webui', async () => {
    delete process.env.FLYPC_ROOT
    delete process.env.APP_METADATA_ROOT
    delete process.env.APP_STORAGE_ROOT

    const { apexService } = await import('../../services/ApexService.js')
    const openWebUi = apexService.getStoreApp('open-webui', 'admin')

    expect(openWebUi.dependencies).toEqual([
      expect.objectContaining({ key: 'ollama', image: 'ollama/ollama', ports: { api: 11434 } }),
    ])
  })

  it('uninstalls an app for the current user and removes storage', async () => {
    setupTempStore()
    const { apexService } = await import('../../services/ApexService.js')
    const { getUserAppStoragePath } = await import('../../controllers/TenantStorage.js')

    await apexService.installApp('admin', 'jellyfin')
    const storagePath = getUserAppStoragePath('admin', 'jellyfin')
    expect(fs.existsSync(storagePath)).toBe(true)

    const uninstalled = await apexService.uninstallApp('admin', 'jellyfin')

    expect(uninstalled.installed).toBe(false)
    expect(fs.existsSync(storagePath)).toBe(false)
  })

  it('removes app metadata when the last user uninstalls', async () => {
    setupTempStore()
    const { apexService } = await import('../../services/ApexService.js')
    const { getInstalledMetadataDir } = await import('../../lib/ApexCatalog.js')

    await apexService.installApp('admin', 'jellyfin')
    expect(fs.existsSync(getInstalledMetadataDir('jellyfin'))).toBe(true)

    await apexService.uninstallApp('admin', 'jellyfin')
    expect(fs.existsSync(getInstalledMetadataDir('jellyfin'))).toBe(false)
  })

  it('blocks installing the Apex system app', async () => {
    setupTempStore()
    const { apexService } = await import('../../services/ApexService.js')

    await expect(apexService.installApp('admin', 'apex')).rejects.toThrow(
      'system app and cannot be installed',
    )
  })
})
