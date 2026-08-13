import { loadAppsCatalog, getAppUsers } from './AppsCatalog.js'
import { loadServiceDefinition } from './ServiceRegistry.js'
import { isKubernetesManaged } from './AppLifecyclePolicy.js'
import { provisionKubernetesWorkload } from './AppControlsService.js'

export type WarmStartProgress = {
  total: number
  completed: number
  current?: { appKey: string; username: string }
  errors: Array<{ appKey: string; username: string; message: string }>
}

let lastProgress: WarmStartProgress = { total: 0, completed: 0, errors: [] }

export const getWarmStartProgress = (): WarmStartProgress => ({ ...lastProgress })

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * On rhost-console boot, reconcile k3s-managed daemon/autorun workloads
 * sequentially in round-robin order: app1/user1, app1/user2, app2/user1, …
 */
export const runKubernetesWarmStartOnBoot = async (): Promise<void> => {
  const catalog = loadAppsCatalog()
  const appKeys = Object.keys(catalog).sort()

  const queue: Array<{ appKey: string; username: string }> = []
  for (const appKey of appKeys) {
    const service = loadServiceDefinition(appKey)
    if (!isKubernetesManaged(service)) {
      continue
    }

    for (const username of getAppUsers(catalog, appKey)) {
      queue.push({ appKey, username })
    }
  }

  lastProgress = { total: queue.length, completed: 0, errors: [] }

  if (queue.length === 0) {
    console.log('[warm-start] No kubernetes/autorun workloads to reconcile')
    return
  }

  console.log(`[warm-start] Reconciling ${queue.length} k3s workload(s)…`)

  // Allow docker socket / rhost-kube to settle after console listen.
  await sleep(3000)

  for (const { appKey, username } of queue) {
    lastProgress = { ...lastProgress, current: { appKey, username } }

    try {
      const service = loadServiceDefinition(appKey)
      await provisionKubernetesWorkload(appKey, username, {
        ...service,
        runtime: 'kubernetes',
      })
      console.log(`[warm-start] reconciled ${username}/${appKey}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastProgress.errors.push({ appKey, username, message })
      console.error(`[warm-start] failed ${username}/${appKey}: ${message}`)
    }

    lastProgress = {
      ...lastProgress,
      completed: lastProgress.completed + 1,
    }
    delete lastProgress.current
  }

  console.log(
    `[warm-start] Done — ${lastProgress.completed}/${lastProgress.total} processed, ${lastProgress.errors.length} error(s)`,
  )
}
