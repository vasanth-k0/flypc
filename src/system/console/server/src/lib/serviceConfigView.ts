import type { ServiceDefinition } from '../types/ServiceDefinition.js'
import { resolveUserPorts } from '../lib/PortResolver.js'
import { getLifecycleCategoryLabel, isKubernetesManaged, isSessionContainer, resolveAppManagementMode, resolveServiceContainerProgram } from '../services/AppLifecyclePolicy.js'
import { getContainerProgram } from '../lib/SystemSettings.js'

export type ServiceConfigRow = {
  label: string
  value: string
}

export type ServiceConfigSection = {
  title: string
  rows: ServiceConfigRow[]
}

export const buildServiceConfigSections = (
  service: ServiceDefinition,
  username: string,
): ServiceConfigSection[] => {
  const sections: ServiceConfigSection[] = []
  const lifecycleCategory = resolveAppManagementMode(service, false)
  const general: ServiceConfigRow[] = [
    { label: 'Type', value: service.type },
    { label: 'Lifecycle', value: getLifecycleCategoryLabel(lifecycleCategory) },
    { label: 'Runtime', value: isKubernetesManaged(service) ? 'kubernetes' : service.runtime ?? 'docker' },
    { label: 'Autorun', value: service.autorun ? 'yes' : 'no' },
  ]

  if (typeof service.image === 'string' && service.image) {
    general.push({ label: 'Image', value: service.image })
  } else if (service.image === false) {
    general.push({ label: 'Image', value: 'none (TTY/session)' })
  }

  if (isSessionContainer(service)) {
    general.push({ label: 'Window close', value: 'pause container (resume on reopen)' })
  }

  if (service.dir) {
    general.push({ label: 'App directory', value: service.dir })
  }

  if (service.readonly !== undefined) {
    general.push({ label: 'Read-only storage', value: service.readonly ? 'yes' : 'no' })
  }

  general.push({
    label: 'Container engine',
    value: resolveServiceContainerProgram(service) ?? getContainerProgram(),
  })

  if (service.storageMount) {
    general.push({ label: 'Storage mount', value: service.storageMount })
  }

  sections.push({ title: 'General', rows: general })

  const { runtime, mappings } = resolveUserPorts(service, username)
  const portRows: ServiceConfigRow[] = []

  for (const mapping of mappings) {
    portRows.push({
      label: mapping.name,
      value: `${mapping.containerPort} → host ${mapping.hostPort}`,
    })
  }

  if (Object.keys(runtime).length > 0) {
    for (const [name, hostPort] of Object.entries(runtime)) {
      if (!portRows.some((row) => row.label === name)) {
        portRows.push({ label: name, value: String(hostPort) })
      }
    }
  }

  if (portRows.length > 0) {
    sections.push({ title: 'Ports', rows: portRows })
  }

  if (service.env && Object.keys(service.env).length > 0) {
    sections.push({
      title: 'Environment',
      rows: Object.entries(service.env).map(([key, value]) => ({ label: key, value })),
    })
  }

  if (service.mounts && service.mounts.length > 0) {
    sections.push({
      title: 'Mounts',
      rows: service.mounts.map((mount) => ({
        label: typeof mount === 'string' ? mount : mount.source,
        value: typeof mount === 'string' ? service.storageMount ?? '/flypc/storage' : mount.target,
      })),
    })
  }

  if (service.actions && Object.keys(service.actions).length > 0) {
    sections.push({
      title: 'Actions',
      rows: Object.entries(service.actions).map(([key, action]) => ({
        label: key,
        value: typeof action === 'string'
          ? action || '(empty)'
          : `${action.executor} → ${action.script}`,
      })),
    })
  }

  if (service.tty) {
    sections.push({
      title: 'TTY',
      rows: [{ label: 'Command', value: service.tty.command ?? 'bash' }],
    })
  }

  if (service.kube) {
    const kubeRows: ServiceConfigRow[] = []
    if (service.kube.replicas !== undefined) {
      kubeRows.push({ label: 'Replicas', value: String(service.kube.replicas) })
    }
    if (service.kube.strategy) {
      kubeRows.push({ label: 'Strategy', value: service.kube.strategy })
    }
    if (service.kube.placement?.tier) {
      kubeRows.push({ label: 'Placement tier', value: service.kube.placement.tier })
    }
    if (service.kube.ingress?.enabled) {
      kubeRows.push({
        label: 'Ingress',
        value: `${service.kube.ingress.host ?? 'auto'}${service.kube.ingress.path ?? '/'}`,
      })
    }
    if (kubeRows.length > 0) {
      sections.push({ title: 'Kubernetes', rows: kubeRows })
    }
  }

  if (service.volumes && service.volumes.length > 0) {
    sections.push({
      title: 'Volumes',
      rows: service.volumes.map((volume) => ({
        label: volume.name,
        value: `${volume.type} → ${volume.mountPath}${volume.size ? ` (${volume.size})` : ''}`,
      })),
    })
  }

  return sections
}
