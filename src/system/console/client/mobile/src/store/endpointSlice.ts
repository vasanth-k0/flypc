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
  portraitLocked: boolean
}

const STORAGE_KEY = 'flypc-mobile-endpoints'

const defaults: EndpointItem[] = [
  { url: 'https://flypc.in', active: true, status: 'offline' },
  { url: 'http://localhost:3000', active: false, status: 'offline' }
]

const loadInitial = (): EndpointItem[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaults
  }

  try {
    const parsed = JSON.parse(raw) as EndpointItem[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaults
    }

    const normalized = parsed.map((entry) => ({
      url: String(entry.url || '').trim(),
      active: Boolean(entry.active),
      status: entry.status === 'online' ? 'online' : 'offline'
    })).filter((entry) => entry.url.length > 0)

    if (normalized.length === 0) {
      return defaults
    }

    if (!normalized.some((entry) => entry.active)) {
      normalized[0].active = true
    }

    return normalized
  } catch {
    return defaults
  }
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
  portraitLocked: true
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
      const url = action.payload.trim()
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
    setPortraitLocked(state, action: PayloadAction<boolean>) {
      state.portraitLocked = action.payload
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

export const { togglePanel, closePanel, addEndpoint, removeEndpoint, setActiveEndpoint, setPortraitLocked } = endpointSlice.actions
export default endpointSlice.reducer
