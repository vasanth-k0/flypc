import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  AppRuntimeStatus,
  ContainerProgram,
  ContainerVolumeMount,
  ServiceDefinition,
} from '../types/ServiceDefinition.js'
import type { ResolvedPortMapping } from '../lib/PortResolver.js'

const execFileAsync = promisify(execFile)

export type ContainerOptions = {
  name: string
  program: ContainerProgram
  service: ServiceDefinition
  volumeMounts: ContainerVolumeMount[]
  portMappings: ResolvedPortMapping[]
  runtimePorts: Record<string, number>
}

export type ContainerInspectResult = {
  id: string
  name: string
  running: boolean
  startedAt?: string
  ports: Record<string, number>
}

export class Container {
  readonly name: string
  private readonly program: ContainerProgram
  private readonly service: ServiceDefinition
  private readonly volumeMounts: ContainerVolumeMount[]
  private readonly portMappings: ResolvedPortMapping[]
  private readonly runtimePorts: Record<string, number>

  constructor(options: ContainerOptions) {
    this.name = options.name
    this.program = options.program
    this.service = options.service
    this.volumeMounts = options.volumeMounts
    this.portMappings = options.portMappings
    this.runtimePorts = options.runtimePorts
  }

  private run(args: string[]): Promise<string> {
    return execFileAsync(this.program, args, { encoding: 'utf8' }).then((result) => result.stdout.trim())
  }

  private buildRunArgs(): string[] {
    if (typeof this.service.image !== 'string' || !this.service.image) {
      throw new Error('Container image is not configured for this service')
    }

    const args = ['run', '-d', '--name', this.name]

    for (const mount of this.volumeMounts) {
      const suffix = mount.readonly ? ':ro' : ''
      args.push('-v', `${mount.source}:${mount.target}${suffix}`)
    }

    if (this.service.env) {
      for (const [key, value] of Object.entries(this.service.env)) {
        args.push('-e', `${key}=${value}`)
      }
    }

    for (const mapping of this.portMappings) {
      args.push('-p', `${mapping.hostPort}:${mapping.containerPort}`)
    }

    args.push(this.service.image)
    return args
  }

  async start(): Promise<string> {
    const status = await this.getStatus()
    if (status === 'running') {
      const inspect = await this.inspect()
      return inspect.id
    }

    if (status === 'stopped') {
      await this.remove()
    }

    const containerId = await this.run(this.buildRunArgs())
    return containerId
  }

  async stop(): Promise<void> {
    if ((await this.getStatus()) === 'missing') {
      return
    }

    try {
      await this.run(['stop', '-t', '10', this.name])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('No such container')) {
        throw error
      }
    }
  }

  async remove(): Promise<void> {
    if ((await this.getStatus()) === 'missing') {
      return
    }

    try {
      await this.run(['rm', '-f', this.name])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('No such container')) {
        throw error
      }
    }
  }

  async inspect(): Promise<ContainerInspectResult> {
    const format = '{{.Id}}|{{.Name}}|{{.State.Running}}|{{.State.StartedAt}}'
    const raw = await this.run(['inspect', '-f', format, this.name])
    const [id = '', name = '', runningRaw = 'false', startedAt = ''] = raw.split('|')

    return {
      id,
      name: name.replace(/^\//, ''),
      running: runningRaw === 'true',
      ...(startedAt ? { startedAt } : {}),
      ports: { ...this.runtimePorts },
    }
  }

  async getStatus(): Promise<AppRuntimeStatus> {
    try {
      const runningRaw = await this.run(['inspect', '-f', '{{.State.Running}}', this.name])
      return runningRaw === 'true' ? 'running' : 'stopped'
    } catch {
      return 'missing'
    }
  }

  async logs(tail = 100): Promise<string> {
    return this.run(['logs', '--tail', String(tail), this.name])
  }

  runInteractive(args: string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.program, args, { stdio: 'inherit' })
      child.on('error', reject)
      child.on('close', (code) => resolve(code ?? 0))
    })
  }
}
