import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getContainerProgram } from '../lib/SystemSettings.js'
import { getHelpersRoot, resolveAppRuntimeRoot } from '../lib/PathResolver.js'
import type { ServiceActionDefinition, ServiceDefinition } from '../types/ServiceDefinition.js'

const TIMEOUT_MS = 180_000

const languageConfig = {
  python: {
    bin: 'python3',
    ext: 'py',
    image: 'docker.io/library/python:3.12-slim',
  },
  php: {
    bin: 'php',
    ext: 'php',
    image: 'docker.io/library/php:8.4-cli-alpine',
  },
  node: {
    bin: 'node',
    ext: 'js',
    image: 'docker.io/library/node:22-alpine',
  },
} as const

type ExecutorName = keyof typeof languageConfig

export class RunOnceExecutor {
  private readonly service: ServiceDefinition
  private readonly action: string
  private readonly payload: string
  private readonly program: ReturnType<typeof getContainerProgram>

  constructor(service: ServiceDefinition, action: string, payload: Record<string, unknown>) {
    this.service = service
    this.action = action
    this.payload = JSON.stringify(payload)
    this.program = getContainerProgram()
  }

  private getActionDefinition(): ServiceActionDefinition {
    const actionDefinition = this.service.actions?.[this.action]
    if (!actionDefinition) {
      throw new Error(`Action "${this.action}" is not defined for this app`)
    }
    return actionDefinition
  }

  async execute(): Promise<string> {
    const actionDefinition = this.getActionDefinition()
    const runtimeRoot = resolveAppRuntimeRoot(this.service.dir ?? '')
    const userScriptHostPath = path.join(runtimeRoot, actionDefinition.script.replace(/^\//, ''))
    const language = languageConfig[actionDefinition.executor as ExecutorName]

    if (!language) {
      throw new Error(`Unsupported executor "${actionDefinition.executor}"`)
    }

    if (!fs.existsSync(userScriptHostPath)) {
      throw new Error(`Controller script not found: ${userScriptHostPath}`)
    }

    const processorHostPath = path.join(getHelpersRoot(), 'run', `process.${language.ext}`)
    const processorContainerPath = `/run/process.${language.ext}`
    const userScriptContainerPath = actionDefinition.script

    const args = [
      'run',
      '--rm',
      '-v',
      `${userScriptHostPath}:${userScriptContainerPath}:ro`,
      '-v',
      `${processorHostPath}:${processorContainerPath}:ro`,
      language.image,
      language.bin,
      processorContainerPath,
      userScriptContainerPath,
      this.payload,
    ]

    return new Promise((resolve, reject) => {
      let output = ''
      const child = spawn(this.program, args, {
        timeout: TIMEOUT_MS,
        killSignal: 'SIGINT',
      })

      child.stdout.on('data', (chunk) => {
        output += String(chunk)
      })

      child.stderr.on('data', (chunk) => {
        output += `Error: ${String(chunk)}`
      })

      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          resolve(output)
          return
        }
        reject(new Error(`Process exited with code ${code}: ${output}`))
      })
    })
  }
}
