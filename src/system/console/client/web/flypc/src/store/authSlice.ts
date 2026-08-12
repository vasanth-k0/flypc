import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { clearAuthToken, getAuthToken, setAuthToken as persistAuthToken } from '../services/apiClient'
import type { AuthUser } from '../types/dashboard'

type AuthState = {
  token: string
  user: AuthUser | null
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? getAuthToken() : '',
  user: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; user: AuthUser }>) => {
      state.token = action.payload.token
      state.user = action.payload.user
      persistAuthToken(action.payload.token)
    },
    setAuthUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload
    },
    setAuthToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload
      if (action.payload) {
        persistAuthToken(action.payload)
      } else {
        clearAuthToken()
      }
    },
    clearAuth: (state) => {
      state.token = ''
      state.user = null
      clearAuthToken()
    },
  },
})

export const { setCredentials, setAuthUser, setAuthToken, clearAuth } = authSlice.actions
export const selectAuthToken = (state: { auth: AuthState }): string => state.auth.token
export const selectAuthUser = (state: { auth: AuthState }): AuthUser | null => state.auth.user
export default authSlice.reducer
