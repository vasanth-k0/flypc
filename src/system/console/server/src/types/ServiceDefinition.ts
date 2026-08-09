export type ContainerProgram = 'podman' | 'docker'

export type ServiceMount =
  | string
  | {
      source: string
      target: string
      readonly?: boolean
    }

export type ServiceActionDefinition = {
  executor: 'python' | 'php' | 'node'
  script: string
}

export type ServiceDependency = {
  key: string
  image: string
  ports?: ServicePortMap
  storageMount?: string
  mounts?: ServiceMount[]
  env?: Record<string, string>
}

export type ServicePortMap = Record<string, number | Record<string, number> | undefined> & {
  users?: Record<string, number>
}

export type ServiceDefinition = {
  type: 'run-once' | 'daemon'
  readonly?: boolean
  autorun?: boolean
  dir?: string
  image?: string | false
  ports?: ServicePortMap
  mounts?: ServiceMount[]
  storageMount?: string
  env?: Record<string, string>
  actions?: Record<string, ServiceActionDefinition>
  dependencies?: ServiceDependency[]
  tty?: {
    command?: string
  }
}

export type ContainerVolumeMount = {
  source: string
  target: string
  readonly?: boolean
}

export type AppRuntimeStatus = 'running' | 'stopped' | 'missing' | 'not-containerized'

export type AppStartResult = {
  ok: boolean
  appKey: string
  status: AppRuntimeStatus
  containerId?: string
  containerName: string
  ports: Record<string, number>
  url: string | null
  detail?: string
}
