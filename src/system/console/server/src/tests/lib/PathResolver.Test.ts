import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from '@jest/globals'

const originalFlypcRoot = process.env.FLYPC_ROOT
const originalCwd = process.cwd()

describe('PathResolver', () => {
  afterEach(() => {
    if (originalFlypcRoot === undefined) {
      delete process.env.FLYPC_ROOT
    } else {
      process.env.FLYPC_ROOT = originalFlypcRoot
    }
    process.chdir(originalCwd)
  })

  it('resolves app views from the monorepo root', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flypc-path-resolver-'))
    const serverDir = path.join(tempRoot, 'src/system/console/server')
    const appViewDir = path.join(tempRoot, 'src/apps/coderun-lite/view')
    fs.mkdirSync(serverDir, { recursive: true })
    fs.mkdirSync(appViewDir, { recursive: true })
    fs.writeFileSync(path.join(appViewDir, 'index.html'), '<!doctype html><title>coderun-lite</title>')
    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify({ name: 'flypc-monorepo' }),
    )

    process.env.FLYPC_ROOT = tempRoot
    process.chdir(serverDir)

    const { getAppViewRoot } = await import('../../lib/PathResolver.js')
    expect(getAppViewRoot('src/apps/coderun-lite')).toBe(appViewDir)
    expect(fs.existsSync(path.join(getAppViewRoot('src/apps/coderun-lite'), 'index.html'))).toBe(true)

    fs.rmSync(tempRoot, { recursive: true, force: true })
  })
})
