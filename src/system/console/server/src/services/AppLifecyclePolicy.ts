import type { ContainerProgram, ServiceDefinition } from '../types/ServiceDefinition.js'
import { getContainerProgram } from '../lib/SystemSettings.js'

export type AppManagementMode =
  | 'run-once'
  | 'stack'
  | 'tty'
  | 'kubernetes'
  | 'on-demand-container'
  | 'not-containerized'

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

/** Daemon apps started on user demand via docker/podman (not k3s). */
export const isOnDemandContainer = (service: ServiceDefinition): boolean =>
  service.type === 'daemon'
  && typeof service.image === 'string'
  && Boolean(service.image)
  && !isKubernetesManaged(service)

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

  if (isOnDemandContainer(service)) {
    return 'on-demand-container'
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
