import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

type EnvSnapshot = Record<string, string | undefined>

describe('FileService', () => {
  let tempRoot = ''
  let envSnapshot: EnvSnapshot = {}

  beforeEach(() => {
    envSnapshot = {
      FLYPC_ROOT: process.env.FLYPC_ROOT,
      APP_METADATA_ROOT: process.env.APP_METADATA_ROOT,
      APP_STORAGE_ROOT: process.env.APP_STORAGE_ROOT,
      TENANT_HOME_ROOT: process.env.TENANT_HOME_ROOT,
    }
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  const setup = (): void => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-files-'))
    const metadataRoot = path.join(tempRoot, 'server/app')
    const markerView = path.join(tempRoot, 'src/apps/coderun-lite/view')
    const homeRoot = path.join(tempRoot, 'homes')
    const storageRoot = path.join(tempRoot, 'storage')

    fs.mkdirSync(metadataRoot, { recursive: true })
    fs.mkdirSync(markerView, { recursive: true })
    fs.mkdirSync(homeRoot, { recursive: true })
    fs.writeFileSync(path.join(markerView, 'index.html'), '<!doctype html><title>coderun-lite</title>')
    fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({ name: 'flypc-monorepo' }))
    fs.writeFileSync(
      path.join(metadataRoot, 'apps.json'),
      JSON.stringify({
        notepad: {
          name: 'Notes',
          icon: 'EditFilled',
          published: true,
          users: ['admin'],
        },
      }),
    )

    process.env.FLYPC_ROOT = tempRoot
    process.env.APP_METADATA_ROOT = metadataRoot
    process.env.APP_STORAGE_ROOT = storageRoot
    process.env.TENANT_HOME_ROOT = homeRoot
  }

  it('lists, creates, moves, searches, and deletes files within a root', async () => {
    setup()
    const {
      createDirectory,
      deletePaths,
      listFiles,
      movePaths,
      searchFiles,
      writeFile,
    } = await import('../../services/FileService.js')

    writeFile('admin', 'home', '', 'notes.txt', Buffer.from('hello'))
    createDirectory('admin', 'home', '', 'projects')
    movePaths('admin', 'home', ['notes.txt'], 'projects')

    const listed = listFiles('admin', 'home', 'projects')
    expect(listed.some((entry) => entry.name === 'notes.txt')).toBe(true)

    const matches = searchFiles('admin', 'home', '', 'notes')
    expect(matches.some((entry) => entry.name === 'notes.txt')).toBe(true)

    deletePaths('admin', 'home', ['projects/notes.txt'])
    expect(listFiles('admin', 'home', 'projects')).toHaveLength(0)
  })

  it('renames and duplicates files within a root', async () => {
    setup()
    const { copyPaths, renamePath, writeFile, listFiles } = await import('../../services/FileService.js')

    writeFile('admin', 'home', '', 'notes.txt', Buffer.from('hello'))
    renamePath('admin', 'home', 'notes.txt', 'journal.txt')

    const renamed = listFiles('admin', 'home', '')
    expect(renamed.some((entry) => entry.name === 'journal.txt')).toBe(true)

    const copied = copyPaths('admin', 'home', ['journal.txt'], '')
    expect(copied.some((entry) => entry.name === 'journal (1).txt')).toBe(true)
  })

  it('rejects path traversal attempts', async () => {
    setup()
    const { listFiles } = await import('../../services/FileService.js')

    expect(() => listFiles('admin', 'home', '../secret')).toThrow('Invalid path')
  })
})
