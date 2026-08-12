import { apiFetch } from '../services/apiClient'

export type ApexStoreApp = {
  key: string
  name: string
  icon: string
  description: string
  about: string
  installed: boolean
  system: boolean
  hasContainerImage: boolean
  dependencies: Array<{
    key: string
    image: string
    ports: Record<string, number>
  }>
  installedUsers: string[]
}

export class Apex {
  async listApps(): Promise<ApexStoreApp[]> {
    const payload = await apiFetch<{ ok: boolean; apps: ApexStoreApp[] }>('/apps/apex/catalog')
    return payload.apps
  }

  async getApp(appKey: string): Promise<ApexStoreApp> {
    const payload = await apiFetch<{ ok: boolean; app: ApexStoreApp }>(
      `/apps/apex/catalog/${encodeURIComponent(appKey)}`,
    )
    return payload.app
  }

  async install(appKey: string): Promise<ApexStoreApp> {
    const payload = await apiFetch<{ ok: boolean; app: ApexStoreApp }>(
      `/apps/apex/catalog/${encodeURIComponent(appKey)}/install`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      { accept202: true },
    )
    return payload.app
  }

  async uninstall(appKey: string): Promise<ApexStoreApp> {
    const payload = await apiFetch<{ ok: boolean; app: ApexStoreApp }>(
      `/apps/apex/catalog/${encodeURIComponent(appKey)}/install`,
      {
        method: 'DELETE',
      },
    )
    return payload.app
  }

  async uninstallForAll(appKey: string): Promise<{ ok: boolean; appKey: string }> {
    return apiFetch<{ ok: boolean; appKey: string }>(
      `/apps/apex/catalog/${encodeURIComponent(appKey)}/install/all`,
      {
        method: 'DELETE',
      },
    )
  }
}
