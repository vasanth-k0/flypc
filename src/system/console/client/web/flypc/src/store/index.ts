import { configureStore } from '@reduxjs/toolkit'
import themeReducer from './themeSlice'
import settingsReducer from './settingsSlice'
import authReducer from './authSlice'
import { themeApi } from './themeApi'
import { settingsApi } from './settingsApi'
import { authApi } from './authApi'
import { appsApi } from './appsApi'

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    settings: settingsReducer,
    auth: authReducer,
    [themeApi.reducerPath]: themeApi.reducer,
    [settingsApi.reducerPath]: settingsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [appsApi.reducerPath]: appsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      themeApi.middleware,
      settingsApi.middleware,
      authApi.middleware,
      appsApi.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
