import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type EndpointStatus = 'online' | 'offline'

export type EndpointItem = {
  url: string
  active: boolean
  status: EndpointStatus
}

type EndpointState = {
  endpoints: EndpointItem[]
  panelOpen: boolean
  orientation: 'portrait' | 'landscape'
}

const STORAGE_KEY = 'flypc-desktop-endpoints'

const defaults: EndpointItem[] = [
  { url: 'https://www.flypc.in', active: true, status: 'offline' },
  { url: 'http://localhost:3000', active: false, status: 'offline' }
]

const PRIMARY_URL = 'https://www.flypc.in'

const ensureDefaults = (entries: EndpointItem[]): EndpointItem[] => {
  const normalized = [...entries]

  for (const fallback of defaults) {
    if (!normalized.some((entry) => entry.url === fallback.url)) {
      normalized.push({ ...fallback, active: false })
    }
  }

  if (!normalized.some((entry) => entry.active) && normalized.length > 0) {
    normalized[0].active = true
  }

  if (normalized.filter((entry) => entry.active).length > 1) {
    let firstActiveSeen = false
    for (const endpoint of normalized) {
      if (endpoint.active && !firstActiveSeen) {
        firstActiveSeen = true
        continue
      }
      endpoint.active = false
    }
  }

  return normalized
}

const preferPrimaryEndpoint = (entries: EndpointItem[]): EndpointItem[] => {
  const hasPrimary = entries.some((entry) => entry.url === PRIMARY_URL)
  if (!hasPrimary) {
    return entries
  }

  for (const entry of entries) {
    entry.active = entry.url === PRIMARY_URL
  }

  return entries
}

const loadInitial = (): EndpointItem[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaults.map((entry) => ({ ...entry }))
  }

  try {
    const parsed = JSON.parse(raw) as EndpointItem[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaults
    }

    const normalized = parsed.map((entry, index) => ({
      url: String(entry.url || '').trim(),
      active: Boolean(entry.active),
      status: entry.status === 'online' ? 'online' : 'offline'
    })).filter((entry) => entry.url.length > 0)

    if (normalized.length === 0) {
      return defaults.map((entry) => ({ ...entry }))
    }

    return preferPrimaryEndpoint(ensureDefaults(normalized))
  } catch {
    return defaults.map((entry) => ({ ...entry }))
  }
}

const normalizeInputUrl = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

const saveState = (endpoints: EndpointItem[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(endpoints))
}

const pingEndpoint = async (url: string): Promise<EndpointStatus> => {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store' })
    return response.ok ? 'online' : 'offline'
  } catch {
    return 'offline'
  } finally {
    window.clearTimeout(timeout)
  }
}

export const refreshEndpointStatus = createAsyncThunk(
  'endpoint/refreshStatus',
  async (urls: string[]): Promise<Record<string, EndpointStatus>> => {
    const pairs = await Promise.all(urls.map(async (url) => [url, await pingEndpoint(url)] as const))
    return Object.fromEntries(pairs)
  }
)

const initialState: EndpointState = {
  endpoints: loadInitial(),
  panelOpen: false,
  orientation: 'portrait'
}

const endpointSlice = createSlice({
  name: 'endpoint',
  initialState,
  reducers: {
    togglePanel(state) {
      state.panelOpen = !state.panelOpen
    },
    closePanel(state) {
      state.panelOpen = false
    },
    addEndpoint(state, action: PayloadAction<string>) {
      const url = normalizeInputUrl(action.payload)
      if (!url || state.endpoints.some((entry) => entry.url === url)) {
        return
      }
      state.endpoints.push({ url, active: state.endpoints.length === 0, status: 'offline' })
      saveState(state.endpoints)
    },
    removeEndpoint(state, action: PayloadAction<string>) {
      state.endpoints = state.endpoints.filter((entry) => entry.url !== action.payload)
      if (state.endpoints.length > 0 && !state.endpoints.some((entry) => entry.active)) {
        state.endpoints[0].active = true
      }
      saveState(state.endpoints)
    },
    setActiveEndpoint(state, action: PayloadAction<string>) {
      for (const endpoint of state.endpoints) {
        endpoint.active = endpoint.url === action.payload
      }
      saveState(state.endpoints)
    },
    setOrientation(state, action: PayloadAction<'portrait' | 'landscape'>) {
      state.orientation = action.payload
    }
  },
  extraReducers: (builder) => {
    builder.addCase(refreshEndpointStatus.fulfilled, (state, action) => {
      for (const endpoint of state.endpoints) {
        endpoint.status = action.payload[endpoint.url] ?? 'offline'
      }
      saveState(state.endpoints)
    })
  }
})

export const { togglePanel, closePanel, addEndpoint, removeEndpoint, setActiveEndpoint, setOrientation } = endpointSlice.actions
export default endpointSlice.reducer
