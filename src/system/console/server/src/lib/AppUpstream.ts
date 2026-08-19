import fs from 'node:fs'

/**
 * Hostname used to reach Docker-published app ports from rhost-console.
 * Inside the rhost container, published ports bind on the host — not 127.0.0.1.
 */
export const resolveAppUpstreamHost = (): string => {
  const configured = process.env.APP_UPSTREAM_HOST?.trim()
  if (configured) {
    return configured
  }

  if (fs.existsSync('/.dockerenv')) {
    return 'host.docker.internal'
  }

  return '127.0.0.1'
}
