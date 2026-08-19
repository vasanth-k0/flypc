import type { AppRuntime, AppVolume, KubeConfig } from '../../types/ServiceDefinition.js'

export type ApexInstallOptions = {
  runtime?: AppRuntime
  volumes?: AppVolume[]
  kube?: Partial<KubeConfig>
}

export type ApexStoreApp = {
  key: string
  name: string
  icon: string
  description: string
  about: string
  installed: boolean
  system: boolean
  appType: 'run-once' | 'daemon'
  hasContainerImage: boolean
  installDefaults: {
    runtime: AppRuntime
    volumes: AppVolume[]
    kube: KubeConfig
  }
  dependencies: Array<{
    key: string
    image: string
    ports: Record<string, number>
  }>
  installedUsers: string[]
}
