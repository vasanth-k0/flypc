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

const buildAuthHeaders = (init?: RequestInit): Headers => {
  const headers = new Headers(init?.headers ?? {})
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const authToken = window.localStorage.getItem('flypc-auth-token')
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  return headers
}

const apiFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: buildAuthHeaders(init),
  })

  const payload = (await response.json()) as T & { error?: string; detail?: string; pending?: boolean }
  if (response.status === 202) {
    return payload as T
  }
  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed: ${response.status}`)
  }

  return payload
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
