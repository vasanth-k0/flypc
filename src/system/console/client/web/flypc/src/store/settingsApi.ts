import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface SettingsPayload {
  name: string
  ui: string
  colorPalette: string
  gotoConsole: boolean
  defaultApp: string
  port: number
  [key: string]: unknown
}

export interface UpdateSettingArg {
  action: 'update'
  property: string
  value: unknown
}

export const settingsApi = createApi({
  reducerPath: 'settingsApi',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: (builder) => ({
    getSettings: builder.query<SettingsPayload, void>({
      query: () => '/system/settings',
    }),
    updateSetting: builder.mutation<{ ok: boolean; property: string; value: unknown }, UpdateSettingArg>({
      query: (body) => ({
        url: '/system/update',
        method: 'POST',
        body,
      }),
    }),
  }),
})

export const { useGetSettingsQuery, useUpdateSettingMutation } = settingsApi
