export const AUTH_TOKEN_KEY = 'flypc-auth-token'

export type ApiFetchOptions = {
  token?: string | null
  accept202?: boolean
}

export const getAuthToken = (): string => window.localStorage.getItem(AUTH_TOKEN_KEY) ?? ''

export const setAuthToken = (token: string): void => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export const clearAuthToken = (): void => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export const buildAuthHeaders = (init?: RequestInit, token?: string | null): Headers => {
  const headers = new Headers(init?.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const hasJsonBody = init?.body !== undefined && !(init.body instanceof FormData)
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const authToken = token ?? getAuthToken()
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  return headers
}

export const apiFetch = async <T>(
  url: string,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: buildAuthHeaders(init, options?.token),
  })

  const payload = (await response.json()) as T & { error?: string; detail?: string; pending?: boolean }

  if (options?.accept202 && response.status === 202) {
    return payload as T
  }

  if (!response.ok) {
    throw new Error(payload.detail ?? payload.error ?? `Request failed (${response.status})`)
  }

  return payload
}
