import type { ContainerProgram, ServiceDefinition } from '../types/ServiceDefinition.js'
import { getContainerProgram } from '../lib/SystemSettings.js'

export type AppManagementMode =
  | 'run-once'
  | 'stack'
  | 'tty'
  | 'kubernetes'
  /** User-session container: start on open, docker pause on close, unpause on reopen. */
  | 'session-container'
  /** @deprecated Use session-container */
  | 'on-demand-container'
  | 'not-containerized'

export const LIFECYCLE_CATEGORY_LABELS: Record<AppManagementMode, string> = {
  'run-once': 'Static view',
  stack: 'Stack service',
  tty: 'Terminal session',
  kubernetes: 'Cluster daemon',
  'session-container': 'Session container',
  'on-demand-container': 'Session container',
  'not-containerized': 'Not containerized',
}

export const getLifecycleCategoryLabel = (mode: AppManagementMode): string =>
  LIFECYCLE_CATEGORY_LABELS[mode] ?? mode

export const isTtyDaemon = (service: ServiceDefinition): boolean =>
  service.type === 'daemon'
  && typeof service.image !== 'string'
  && typeof service.ports?.tty === 'number'

export const isStaticViewApp = (service: ServiceDefinition): boolean =>
  service.type === 'run-once'

/** Daemon/autorun workloads reconciled by rhost-kube / k3s (see service.json). */
export const isKubernetesManaged = (service: ServiceDefinition): boolean =>
  service.type === 'daemon'
  && typeof service.image === 'string'
  && Boolean(service.image)
  && (service.runtime === 'kubernetes' || service.autorun === true)

/** Session container apps: daemon + image, docker/podman, pause/resume per user window. */
export const isSessionContainer = (service: ServiceDefinition): boolean =>
  service.type === 'daemon'
  && typeof service.image === 'string'
  && Boolean(service.image)
  && !isKubernetesManaged(service)

/** @deprecated Use isSessionContainer */
export const isOnDemandContainer = isSessionContainer

export const resolveAppManagementMode = (
  service: ServiceDefinition,
  stackManaged: boolean,
): AppManagementMode => {
  if (service.type === 'run-once') {
    return 'run-once'
  }

  if (stackManaged) {
    return 'stack'
  }

  if (isTtyDaemon(service)) {
    return 'tty'
  }

  if (isKubernetesManaged(service)) {
    return 'kubernetes'
  }

  if (isSessionContainer(service)) {
    return 'session-container'
  }

  return 'not-containerized'
}

export const resolveServiceContainerProgram = (
  service: ServiceDefinition,
): ContainerProgram => {
  if (service.containerProgram === 'docker' || service.containerProgram === 'podman') {
    return service.containerProgram
  }

  return getContainerProgram()
}
