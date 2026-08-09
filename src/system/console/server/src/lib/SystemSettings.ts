import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContainerProgram } from '../types/ServiceDefinition.js'
import { readBlueprint } from '../controllers/TenantStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type SystemSettings = {
  containerProgram: ContainerProgram
  [key: string]: unknown
}

const settingsCandidates = [
  path.resolve(__dirname, '../settings.json'),
  path.resolve(process.cwd(), 'src/settings.json'),
  path.resolve(process.cwd(), 'settings.json'),
]

const defaultSettings: SystemSettings = {
  containerProgram: 'docker',
}

export const loadSystemSettingsFile = (): SystemSettings => {
  const settingsPath = settingsCandidates.find((candidate) => fs.existsSync(candidate))
  if (!settingsPath) {
    return { ...defaultSettings }
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const program = parsed.containerProgram === 'podman' ? 'podman' : 'docker'
    return {
      ...defaultSettings,
      ...parsed,
      containerProgram: program,
    }
  } catch {
    return { ...defaultSettings }
  }
}

export const getContainerProgram = (): ContainerProgram => {
  const blueprint = readBlueprint()
  const fromBlueprint = blueprint.containerProgram
  if (fromBlueprint === 'docker' || fromBlueprint === 'podman') {
    return fromBlueprint
  }

  return loadSystemSettingsFile().containerProgram
}
