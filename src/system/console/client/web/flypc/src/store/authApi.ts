import { createApi } from '@reduxjs/toolkit/query/react'
import type { AuthUser, MemberSummary } from '../types/dashboard'
import { authenticatedBaseQuery } from './baseQuery'

type AuthPayload = { ok: boolean; token: string; user: AuthUser }

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: authenticatedBaseQuery,
  tagTypes: ['Auth', 'Members'],
  endpoints: (builder) => ({
    getMe: builder.query<{ ok: boolean; user: AuthUser }, void>({
      query: () => '/user/me',
      providesTags: ['Auth'],
    }),
    getMembers: builder.query<{ ok: boolean; members: MemberSummary[] }, void>({
      query: () => '/user/members',
      providesTags: ['Members'],
    }),
    login: builder.mutation<AuthPayload, { username: string; password: string }>({
      query: (body) => ({
        url: '/user/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth', 'Members'],
    }),
    logout: builder.mutation<{ ok: boolean }, void>({
      query: () => ({
        url: '/user/logout',
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['Auth', 'Members'],
    }),
    changeName: builder.mutation<AuthPayload, { newUsername: string }>({
      query: (body) => ({
        url: '/user/change-name',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth', 'Members'],
    }),
    resetPassword: builder.mutation<{ ok: boolean }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({
        url: '/user/reset-password',
        method: 'POST',
        body,
      }),
    }),
  }),
})

export const {
  useGetMeQuery,
  useGetMembersQuery,
  useLoginMutation,
  useLogoutMutation,
  useChangeNameMutation,
  useResetPasswordMutation,
} = authApi
