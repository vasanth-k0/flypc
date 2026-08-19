import fs from 'node:fs'
import path from 'node:path'
import { getAppMetadataPath } from '../lib/PathResolver.js'
import type { ServiceDefinition } from '../types/ServiceDefinition.js'

export const loadServiceDefinition = (appKey: string): ServiceDefinition => {
  const servicePath = getAppMetadataPath(appKey, 'service.json')
  if (!fs.existsSync(servicePath)) {
    throw new Error(`service.json not found for app "${appKey}"`)
  }

  const raw = fs.readFileSync(servicePath, 'utf8')
  return JSON.parse(raw) as ServiceDefinition
}
