import { apiFetch } from '../services/apiClient'

export type AppRuntimeStatus = 'running' | 'stopped' | 'paused' | 'missing' | 'not-containerized'

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

  async pause(): Promise<AppRuntime> {
    const runtime = await apiFetch<AppRuntime>(`/apps/${this.key}/pause`, {
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
