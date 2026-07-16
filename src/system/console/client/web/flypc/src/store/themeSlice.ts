import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { ColorPalette } from '../globals/ColorPalette'
import { themeApi } from './themeApi'

export interface ThemeState {
  defaultTheme: string
  activeTheme: string
  primary: string
  secondary: string
}

const initialState: ThemeState = {
  defaultTheme: 'Geekblue',
  activeTheme: 'Geekblue',
  primary: ColorPalette.primary,
  secondary: ColorPalette.secondary,
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setColorPalette(state, action: PayloadAction<string>) {
      const themeName = action.payload as keyof typeof ColorPalette.options
      ColorPalette.configure(themeName)
      state.activeTheme = action.payload
      state.primary = ColorPalette.primary
      state.secondary = ColorPalette.secondary
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(
      themeApi.endpoints.getTheme.matchFulfilled,
      (state, action) => {
        const { default: defaultTheme, active: activeTheme } = action.payload
        state.defaultTheme = defaultTheme
        state.activeTheme = activeTheme

        const themeName = activeTheme as keyof typeof ColorPalette.options
        ColorPalette.configure(themeName)
        state.primary = ColorPalette.primary
        state.secondary = ColorPalette.secondary
      }
    )
  },
})

export const { setColorPalette } = themeSlice.actions
export default themeSlice.reducer
