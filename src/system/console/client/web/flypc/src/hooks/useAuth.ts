import React from 'react'
import { Modal } from 'antd'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  useChangeNameMutation,
  useGetMeQuery,
  useGetMembersQuery,
  useLoginMutation,
  useLogoutMutation,
  useResetPasswordMutation,
} from '../store/authApi'
import { clearAuth, setAuthUser, setCredentials } from '../store/authSlice'
import type { MemberSummary } from '../types/dashboard'

type UseAuthOptions = {
  onLoginSuccess?: () => void
}

export const useAuth = (options?: UseAuthOptions) => {
  const dispatch = useAppDispatch()
  const authToken = useAppSelector((state) => state.auth.token)
  const authUser = useAppSelector((state) => state.auth.user)

  const [accountMessage, setAccountMessage] = React.useState('')
  const [accountError, setAccountError] = React.useState('')
  const [loginUsername, setLoginUsername] = React.useState('')
  const [loginPassword, setLoginPassword] = React.useState('')
  const [changeNameValue, setChangeNameValue] = React.useState('')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')

  const { data: meData, error: meError } = useGetMeQuery(undefined, { skip: !authToken })
  const { data: membersData, error: membersQueryError } = useGetMembersQuery(undefined, {
    skip: !authToken || authUser?.role !== 'Admin',
  })

  const [loginMutation] = useLoginMutation()
  const [logoutMutation] = useLogoutMutation()
  const [changeNameMutation] = useChangeNameMutation()
  const [resetPasswordMutation] = useResetPasswordMutation()

  React.useEffect(() => {
    if (!authToken) {
      dispatch(setAuthUser(null))
      return
    }

    if (meData?.user) {
      dispatch(setAuthUser(meData.user))
      setChangeNameValue(meData.user.username)
    }
  }, [authToken, meData, dispatch])

  React.useEffect(() => {
    if (meError && authToken) {
      dispatch(clearAuth())
    }
  }, [meError, authToken, dispatch])

  const members: MemberSummary[] = membersData?.members ?? []
  const membersError = membersQueryError
    ? 'error' in membersQueryError
      ? String(membersQueryError.error)
      : 'Unable to load members'
    : ''

  const clearAccountFeedback = React.useCallback(() => {
    setAccountMessage('')
    setAccountError('')
  }, [])

  const handleLogin = React.useCallback(async (): Promise<void> => {
    clearAccountFeedback()
    try {
      const payload = await loginMutation({ username: loginUsername, password: loginPassword }).unwrap()
      dispatch(setCredentials({ token: payload.token, user: payload.user }))
      setChangeNameValue(payload.user.username)
      setAccountMessage('Logged in successfully.')
      setLoginPassword('')
      options?.onLoginSuccess?.()
      Modal.destroyAll()
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }, [clearAccountFeedback, dispatch, loginMutation, loginPassword, loginUsername, options])

  const handleLoginRequest = React.useCallback(() => {
    Modal.confirm({
      title: 'Refresh app sessions?',
      content: 'Signing in will refresh all currently opened app sessions. Do you want to proceed?',
      okText: 'Proceed and sign in',
      cancelText: 'Cancel',
      onOk: () => handleLogin(),
    })
  }, [handleLogin])

  const handleLogout = React.useCallback(async (): Promise<void> => {
    clearAccountFeedback()
    try {
      await logoutMutation().unwrap()
    } catch {
      // Ignore logout failures and clear local auth state anyway.
    }

    dispatch(clearAuth())
    setAccountMessage('Logged out.')
  }, [clearAccountFeedback, dispatch, logoutMutation])

  const handleChangeName = React.useCallback(async (): Promise<void> => {
    clearAccountFeedback()
    try {
      const payload = await changeNameMutation({ newUsername: changeNameValue }).unwrap()
      dispatch(setCredentials({ token: payload.token, user: payload.user }))
      setAccountMessage('Name updated successfully.')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }, [changeNameMutation, changeNameValue, clearAccountFeedback, dispatch])

  const handleResetPassword = React.useCallback(async (): Promise<void> => {
    clearAccountFeedback()
    try {
      await resetPasswordMutation({ currentPassword, newPassword }).unwrap()
      setCurrentPassword('')
      setNewPassword('')
      setAccountMessage('Password updated successfully.')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }, [clearAccountFeedback, currentPassword, newPassword, resetPasswordMutation])

  return {
    authToken,
    authUser,
    members,
    accountMessage,
    accountError,
    membersError,
    loginUsername,
    loginPassword,
    changeNameValue,
    currentPassword,
    newPassword,
    setLoginUsername,
    setLoginPassword,
    setChangeNameValue,
    setCurrentPassword,
    setNewPassword,
    handleLogin,
    handleLoginRequest,
    handleLogout,
    handleChangeName,
    handleResetPassword,
  }
}
