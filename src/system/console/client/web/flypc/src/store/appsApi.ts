import { createApi } from '@reduxjs/toolkit/query/react'
import type { AppEntry } from '../types/dashboard'
import { authenticatedBaseQuery } from './baseQuery'

export const appsApi = createApi({
  reducerPath: 'appsApi',
  baseQuery: authenticatedBaseQuery,
  tagTypes: ['Apps'],
  endpoints: (builder) => ({
    getAppsList: builder.query<AppEntry[], void>({
      query: () => '/apps/list',
      providesTags: ['Apps'],
    }),
  }),
})

export const { useGetAppsListQuery } = appsApi
