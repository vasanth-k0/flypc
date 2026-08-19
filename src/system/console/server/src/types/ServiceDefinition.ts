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

export type AppRuntime = 'docker' | 'kubernetes'

export type AppVolumeType = 'persistent' | 'emptyDir' | 'hostPath'

export type AppVolume = {
  name: string
  type: AppVolumeType
  mountPath: string
  size?: string
  storageClass?: string
  nodeSubdomain?: string
  hostPath?: string
}

export type KubePlacement = {
  subdomains?: string[]
  tier?: 'entry' | 'worker' | 'any'
  nodeSelector?: Record<string, string>
}

export type KubeResources = {
  requests?: { cpu?: string; memory?: string }
  limits?: { cpu?: string; memory?: string }
}

export type KubeIngress = {
  enabled?: boolean
  path?: string
  host?: string
}

export type KubeConfig = {
  replicas?: number
  placement?: KubePlacement
  resources?: KubeResources
  ingress?: KubeIngress
  strategy?: 'RollingUpdate' | 'Recreate'
}

export type ServiceDefinition = {
  type: 'run-once' | 'daemon'
  readonly?: boolean
  /** When true (or runtime kubernetes), workload is managed by rhost-kube/k3s. */
  autorun?: boolean
  /** Per-app container engine override for on-demand docker workloads. */
  containerProgram?: ContainerProgram
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
  runtime?: AppRuntime
  volumes?: AppVolume[]
  kube?: KubeConfig
}

export type ContainerVolumeMount = {
  source: string
  target: string
  readonly?: boolean
}

export type AppRuntimeStatus = 'running' | 'stopped' | 'paused' | 'missing' | 'not-containerized'

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
