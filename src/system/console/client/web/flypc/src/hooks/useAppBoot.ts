import React from 'react'
import { App, type AppRuntime } from '../apps/App'
import type { BootStep } from '../components/AppBootChecklist'

type BootStatusResponse = {
  requiresChecklist: boolean
  ready: boolean
  failed: boolean
  steps: BootStep[]
  proxyUrl: string | null
  pollIntervalMs: number
  timeoutMs: number
}

const authHeaders = (): HeadersInit => {
  const headers = new Headers({ Accept: 'application/json' })
  const token = window.localStorage.getItem('flypc-auth-token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

type UseAppBootResult = {
  loading: boolean
  error: string | null
  runtime: AppRuntime | null
  steps: BootStep[]
  failed: boolean
}

export const useAppBoot = (appKey: string): UseAppBootResult => {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [runtime, setRuntime] = React.useState<AppRuntime | null>(null)
  const [steps, setSteps] = React.useState<BootStep[]>([])
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    const app = new App(appKey)
    let cancelled = false
    let pollTimer: number | undefined

    const clearPoll = (): void => {
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer)
        pollTimer = undefined
      }
    }

    const boot = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setFailed(false)
      setSteps([])
      setRuntime(null)

      try {
        const started = await app.start()
        if (cancelled) return

        const initialStatus = await fetch(`/apps/${encodeURIComponent(appKey)}/boot-status`, {
          headers: authHeaders(),
        })

        if (!initialStatus.ok) {
          throw new Error('Unable to read boot status')
        }

        const bootMeta = (await initialStatus.json()) as BootStatusResponse

        if (!bootMeta.requiresChecklist) {
          setRuntime({
            ...started,
            url: bootMeta.proxyUrl ?? started.url ?? `/apps/${appKey}/view/`,
          })
          setLoading(false)
          return
        }

        const startedAt = Date.now()

        const poll = async (): Promise<void> => {
          if (cancelled) return

          const response = await fetch(`/apps/${encodeURIComponent(appKey)}/boot-status`, {
            headers: authHeaders(),
          })

          if (!response.ok) {
            throw new Error('Unable to read boot status')
          }

          const status = (await response.json()) as BootStatusResponse
          setSteps(status.steps)
          setFailed(status.failed)

          if (status.failed) {
            const failedStep = status.steps.find((step) => step.state === 'failed')
            setError(failedStep?.detail ?? 'Application failed to start')
            setLoading(false)
            clearPoll()
            return
          }

          if (status.ready) {
            setRuntime({
              ...started,
              url: status.proxyUrl ?? started.url,
              status: 'running',
            })
            setLoading(false)
            clearPoll()
            return
          }

          if (Date.now() - startedAt >= status.timeoutMs) {
            setFailed(true)
            setError('Application did not become ready in time')
            setLoading(false)
            clearPoll()
            return
          }

          pollTimer = window.setTimeout(() => {
            void poll()
          }, status.pollIntervalMs)
        }

        await poll()
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : String(bootError))
          setFailed(true)
          setLoading(false)
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
      clearPoll()
      void app.pause().catch(() => {
        // Ignore pause errors during window teardown.
      })
    }
  }, [appKey])

  return { loading, error, runtime, steps, failed }
}
