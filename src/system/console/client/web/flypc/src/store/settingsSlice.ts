import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { settingsApi } from './settingsApi'

export type LayoutMode = 'desktop' | 'dashboard' | 'hybrid-console'

export interface SettingsState {
  name: string
  ui: LayoutMode
  colorPalette: string
  gotoConsole: boolean
  defaultApp: string
  port: number
  wallp: number
}

const initialState: SettingsState = {
  name: 'FlyPC',
  ui: 'desktop',
  colorPalette: 'Geekblue',
  gotoConsole: true,
  defaultApp: 'coderun-lite',
  port: 3000,
  wallp: 1,
}

const normalizeLayout = (value?: string): LayoutMode => {
  switch (value?.toLowerCase()) {
    case 'dashboard':
      return 'dashboard'
    case 'hybrid-console':
    case 'hybrid_console':
      return 'hybrid-console'
    case 'desktop':
    default:
      return 'desktop'
  }
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLayoutMode(state, action: PayloadAction<LayoutMode>) {
      state.ui = action.payload
    },
    setWallpaper(state, action: PayloadAction<number>) {
      state.wallp = action.payload
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(settingsApi.endpoints.getSettings.matchFulfilled, (state, action) => {
      state.name = String(action.payload.name ?? state.name)
      state.ui = normalizeLayout(String(action.payload.ui ?? state.ui))
      state.colorPalette = String(action.payload.colorPalette ?? state.colorPalette)
      state.gotoConsole = Boolean(action.payload.gotoConsole ?? state.gotoConsole)
      state.defaultApp = String(action.payload.defaultApp ?? state.defaultApp)
      state.port = Number(action.payload.port ?? state.port)
      state.wallp = Number(action.payload.wallp ?? state.wallp)
    })
  },
})

export const { setLayoutMode, setWallpaper } = settingsSlice.actions
export default settingsSlice.reducer
