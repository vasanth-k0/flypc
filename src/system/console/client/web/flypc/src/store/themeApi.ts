import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface ThemePayload {
  default: string
  active: string
}

export const themeApi = createApi({
  reducerPath: 'themeApi',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  endpoints: (builder) => ({
    getTheme: builder.query<ThemePayload, void>({
      query: () => '/system/theme',
    }),
  }),
})

export const { useGetThemeQuery } = themeApi
