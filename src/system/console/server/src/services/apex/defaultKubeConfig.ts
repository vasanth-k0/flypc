import type { KubeConfig } from '../../types/ServiceDefinition.js'

export const defaultKubeConfig = (): KubeConfig => ({
  replicas: 1,
  placement: { tier: 'any' },
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
  ingress: { enabled: false, path: '/' },
  strategy: 'RollingUpdate',
})
