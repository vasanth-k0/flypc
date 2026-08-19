import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

type TtySession = {
  process: ChildProcess | null
  port: number
  command: string
  managed: boolean
}

const sessions = new Map<string, TtySession>()

const sessionKey = (username: string, appKey: string): string => `${username}:${appKey}`

export const isPortListening = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    const finish = (value: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(500)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })

const waitForPort = async (port: number, attempts = 30): Promise<boolean> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isPortListening(port)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return false
}

export const buildTtyUrl = (port: number): string => `http://127.0.0.1:${port}/`

export const startTtySession = async (
  username: string,
  appKey: string,
  port: number,
  command = 'bash',
): Promise<void> => {
  const key = sessionKey(username, appKey)
  const existing = sessions.get(key)

  if (existing && (await isPortListening(port))) {
    return
  }

  if (await isPortListening(port)) {
    sessions.set(key, { process: null, port, command, managed: false })
    return
  }

  const args = [
    '-W',
    '-p',
    String(port),
    '-t',
    'fontFamily=DejaVu Sans Mono, monospace',
    '-t',
    'fontSize=14',
    '-t',
    'scrollback=3000',
    '-t',
    'cursorBlink=true',
    '-t',
    'padding=10px',
    '-t',
    'theme={"background":"#000000","foreground":"#ffffff","cursor":"#ffffff"}',
    command,
  ]

  const child = spawn('ttyd', args, {
    stdio: 'ignore',
  })

  const started = await waitForPort(port)
  if (!started || child.killed) {
    child.kill('SIGTERM')
    throw new Error(`ttyd failed to start on port ${port}. Install ttyd and try again.`)
  }

  child.on('exit', () => {
    const session = sessions.get(key)
    if (session?.process === child) {
      sessions.delete(key)
    }
  })

  sessions.set(key, { process: child, port, command, managed: true })
}

export const stopTtySession = async (username: string, appKey: string): Promise<void> => {
  const key = sessionKey(username, appKey)
  const session = sessions.get(key)
  if (!session) {
    return
  }

  sessions.delete(key)

  if (!session.managed || !session.process || session.process.killed) {
    return
  }

  session.process.kill('SIGTERM')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await isPortListening(session.port))) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

export const getTtySessionStatus = async (port: number): Promise<'running' | 'stopped'> =>
  (await isPortListening(port)) ? 'running' : 'stopped'
