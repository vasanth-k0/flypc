import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getAuthToken } from '../services/apiClient'

export const authenticatedBaseQuery = fetchBaseQuery({
  baseUrl: '',
  credentials: 'include',
  prepareHeaders: (headers) => {
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const token = getAuthToken()
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return headers
  },
})
