export type AppRuntimeStatus = 'running' | 'stopped' | 'missing' | 'not-containerized'

export type AppRuntime = {
  ok: boolean
  appKey: string
  status: AppRuntimeStatus
  containerId?: string
  containerName: string
  ports: Record<string, number>
  url: string | null
  detail?: string
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

  const payload = (await response.json()) as T & { error?: string; detail?: string }
  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed: ${response.status}`)
  }

  return payload
}

export class App {
  readonly key: string
  private runtime: AppRuntime | null = null

  constructor(appKey: string) {
    this.key = appKey
  }

  getRuntime(): AppRuntime | null {
    return this.runtime
  }

  async start(): Promise<AppRuntime> {
    const runtime = await apiFetch<AppRuntime>(`/apps/${this.key}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    this.runtime = runtime
    return runtime
  }

  async stop(): Promise<AppRuntime> {
    const runtime = await apiFetch<AppRuntime>(`/apps/${this.key}/stop`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    this.runtime = runtime
    return runtime
  }

  async status(): Promise<AppRuntime & { storagePath?: string; containerProgram?: string }> {
    const runtime = await apiFetch<AppRuntime & { storagePath?: string; containerProgram?: string }>(
      `/apps/${this.key}/status`,
    )
    this.runtime = runtime
    return runtime
  }

  async removeContainer(): Promise<void> {
    await apiFetch<{ ok: boolean }>(`/apps/${this.key}/container`, {
      method: 'DELETE',
    })
    this.runtime = null
  }

  getServiceUrl(): string | null {
    return this.runtime?.url ?? null
  }
}
