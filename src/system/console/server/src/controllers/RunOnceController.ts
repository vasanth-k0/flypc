import type { Request, Response } from 'express'
import { RunOnceExecutor } from '../services/RunOnceExecutor.js'
import { loadServiceDefinition } from '../services/ServiceRegistry.js'

const allowedActions = new Set(['py', 'php', 'js'])

export const runAppActionHandler = async (req: Request, res: Response): Promise<void> => {
  const appKey = String(req.params.appKey ?? '')
  const action = String(req.params.action ?? '')

  if (!/^[a-z0-9-]+$/i.test(appKey)) {
    res.status(400).send('Invalid application key')
    return
  }

  if (!allowedActions.has(action)) {
    res.status(400).send('Invalid run action')
    return
  }

  try {
    const service = loadServiceDefinition(appKey)
    if (service.type !== 'run-once') {
      res.status(400).send('This application does not support run-once actions')
      return
    }

    const payload = {
      ...(typeof req.query === 'object' ? req.query : {}),
      ...(typeof req.body === 'object' && req.body !== null ? req.body : {}),
    }

    const executor = new RunOnceExecutor(service, action, payload)
    const output = await executor.execute()
    res.type('text/plain').send(output)
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : String(error))
  }
}
