import { Apex } from '../../apps/Apex'
import { FileManager } from '../../apps/FileManager'

const mockFetch = (payload: unknown, ok = true): jest.Mock =>
  jest.fn().mockResolvedValue({
    ok,
    json: async () => payload,
  })

describe('Apex client', () => {
  beforeEach(() => {
    window.localStorage.setItem('flypc-auth-token', 'test-token')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    window.localStorage.clear()
  })

  it('lists catalog apps', async () => {
    const fetchMock = mockFetch({
      ok: true,
      apps: [{ key: 'jellyfin', name: 'Jellyfin', installed: false }],
    })
    globalThis.fetch = fetchMock as typeof fetch

    const apex = new Apex()
    const apps = await apex.listApps()

    expect(fetchMock).toHaveBeenCalledWith(
      '/apps/apex/catalog',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    )
    expect(apps).toHaveLength(1)
    expect(apps[0]?.key).toBe('jellyfin')
  })

  it('installs and uninstalls an app', async () => {
    const installedApp = { key: 'plex', name: 'Plex', installed: true }
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, app: installedApp }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, app: { ...installedApp, installed: false } }),
      }) as typeof fetch

    const apex = new Apex()
    const installed = await apex.install('plex')
    const uninstalled = await apex.uninstall('plex')

    expect(installed.installed).toBe(true)
    expect(uninstalled.installed).toBe(false)
  })
})

describe('FileManager client', () => {
  beforeEach(() => {
    window.localStorage.setItem('flypc-auth-token', 'test-token')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    window.localStorage.clear()
  })

  it('loads roots and lists files', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          roots: [
            { id: 'local', label: 'This PC', kind: 'local', accessible: true },
            { id: 'home', label: 'FlyDrive', kind: 'home', accessible: true },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          entries: [{ name: 'notes.txt', path: 'notes.txt', type: 'file', size: 5, modifiedAt: '2026-01-01T00:00:00.000Z' }],
        }),
      }) as typeof fetch

    const manager = new FileManager()
    const roots = await manager.listRoots()
    const listing = await manager.list('home')

    expect(roots.some((root) => root.label === 'FlyDrive')).toBe(true)
    expect(listing.entries[0]?.name).toBe('notes.txt')
  })

  it('renames, copies, and loads tree children', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, entry: { name: 'renamed.txt', path: 'renamed.txt', type: 'file', size: 1, modifiedAt: '2026-01-01T00:00:00.000Z' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, entries: [{ name: 'renamed (1).txt', path: 'renamed (1).txt', type: 'file', size: 1, modifiedAt: '2026-01-01T00:00:00.000Z' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, nodes: [{ title: 'projects', key: 'projects', isLeaf: true }] }),
      }) as typeof fetch

    const manager = new FileManager()
    const renamed = await manager.renamePath('home', 'notes.txt', 'renamed.txt')
    const copied = await manager.copyPaths('home', ['renamed.txt'], '')
    const nodes = await manager.listTreeChildren('home')

    expect(renamed.name).toBe('renamed.txt')
    expect(copied[0]?.name).toBe('renamed (1).txt')
    expect(nodes[0]?.key).toBe('projects')
  })

  it('deletes and moves paths', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          entries: [{ name: 'notes.txt', path: 'projects/notes.txt', type: 'file', size: 5, modifiedAt: '2026-01-01T00:00:00.000Z' }],
        }),
      }) as typeof fetch

    const manager = new FileManager()
    await manager.deletePaths('home', ['old.txt'])
    const moved = await manager.movePaths('home', ['notes.txt'], 'projects')

    expect(moved[0]?.path).toBe('projects/notes.txt')
  })
})
