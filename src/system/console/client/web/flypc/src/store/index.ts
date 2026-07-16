import { configureStore } from '@reduxjs/toolkit'
import themeReducer from './themeSlice'
import settingsReducer from './settingsSlice'
import { themeApi } from './themeApi'
import { settingsApi } from './settingsApi'

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    settings: settingsReducer,
    [themeApi.reducerPath]: themeApi.reducer,
    [settingsApi.reducerPath]: settingsApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(themeApi.middleware, settingsApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
