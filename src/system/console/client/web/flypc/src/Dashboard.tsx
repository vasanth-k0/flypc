import React from 'react'
import { Button, Input, Modal } from 'antd'
import { useAppSelector, useAppDispatch } from './store/hooks'
import { setControlsSide, setLayoutMode, setWallpaper } from './store/settingsSlice'
import type { LayoutMode } from './store/settingsSlice'
import { setColorPalette } from './store/themeSlice'
import { ColorPalette } from './globals/ColorPalette'
import { useUpdateSettingMutation } from './store/settingsApi'
import { AppWindow } from './components/AppWindow'
import { FileExplorer } from './components/FileExplorer'
import { NativeWindowContent } from './components/NativeWindowContent'
import { WebAppCards } from './components/WebAppCards'
import { MdClose, MdMinimize } from 'react-icons/md'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import {
  AppstoreOutlined,
  MonitorOutlined,
  EditFilled,
  CodeFilled,
  ThunderboltFilled,
  FileTextFilled,
  DatabaseFilled,
  SettingOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'

// All available wallpaper IDs (must match files in /resources/vx-{id}.webp)
const WALLPAPER_IDS = [0, 1, 3, 5, 7, 10, 15, 17, 19, 21, 23, 25, 26, 27, 30, 33]

// Helper function to dynamically calculate text contrast color (black or white) based on background hex
const getTextColor = (bgColor: string): string => {
  if (!bgColor || !bgColor.startsWith('#')) return '#ffffff'
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)
  // standard relative luminance (YIQ) formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000000' : '#ffffff'
}

type AppEntry = {
  key: string
  name: string
  icon: string
  description?: string
  published: boolean
  users: string[]
}

type WindowId = 'apps' | 'monitor' | 'files' | 'terminal' | 'settings' | 'accounts' | 'members' | `app:${string}`

type AuthUser = {
  id: string
  username: string
  role: 'Admin' | 'Guest'
}

type MemberSummary = {
  id: string
  username: string
  role: 'Admin' | 'Guest'
  createdAt: string
  apps: string[]
  totalStorageBytes: number
  totalStorageMB: number
  usagePercent: number
}

type DesktopBridgeWindow = Window & {
  flypcDesktop?: {
    toggleFullScreen?: () => Promise<boolean>
  }
}

const APP_ICON_MAP: Record<string, React.ReactNode> = {
  EditFilled: <EditFilled style={{ color: '#334155' }} />,
  CodeFilled: <CodeFilled style={{ color: '#334155' }} />,
  ThunderboltFilled: <ThunderboltFilled style={{ color: '#334155' }} />,
  DatabaseFilled: <DatabaseFilled style={{ color: '#334155' }} />,
  FileTextFilled: <FileTextFilled style={{ color: '#334155' }} />,
  AppstoreOutlined: <AppstoreOutlined style={{ color: '#334155' }} />,
}

export const appbrick: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  cursor: 'pointer',
  margin: '0',
  transition: 'all 0.5s ease',
}

const hybridAppbrick: React.CSSProperties = {
  ...appbrick,
  gap: '0',
  justifyContent: 'space-between',
  border: 'none',
  borderRadius: 5,
  padding: '10px 7px 8px',
  fontSize: '10px',
  textAlign: 'center',
  background: '#ffffffca',
  backdropFilter: 'blur(7px)',
  width: '3.35rem',
  height: '3.75rem',
}

const formatBytes = (value: number): string => {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const [updateSetting] = useUpdateSettingMutation()

  // Redux state
  const { name, ui: layoutMode, controlsSide, wallp: activeWallp } = useAppSelector((state) => state.settings)
  const { activeTheme, primary, secondary } = useAppSelector((state) => state.theme)

  // Current active window in our mock dashboard
  const [activeWindowId, setActiveWindowId] = React.useState<WindowId>('apps')
  const [appsListReturnWindowId, setAppsListReturnWindowId] = React.useState<WindowId | null>(null)
  const [openApps, setOpenApps] = React.useState<AppEntry[]>([])
  const [appSessionVersion, setAppSessionVersion] = React.useState(0)
  const [openAppControls, setOpenAppControls] = React.useState<Record<string, boolean>>({})
  const [hoveredClosableMenuKey, setHoveredClosableMenuKey] = React.useState<string | null>(null)
  const [openedAccountsMenuArea, setOpenedAccountsMenuArea] = React.useState<'sidebar' | 'footer' | null>(null)
  const [apps, setApps] = React.useState<AppEntry[]>([])
  const [appsError, setAppsError] = React.useState<string | null>(null)
  const [authToken, setAuthToken] = React.useState<string>(() => window.localStorage.getItem('flypc-auth-token') ?? '')
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null)
  const [accountMessage, setAccountMessage] = React.useState<string>('')
  const [accountError, setAccountError] = React.useState<string>('')
  const [loginUsername, setLoginUsername] = React.useState<string>('')
  const [loginPassword, setLoginPassword] = React.useState<string>('')
  const [changeNameValue, setChangeNameValue] = React.useState<string>('')
  const [currentPassword, setCurrentPassword] = React.useState<string>('')
  const [newPassword, setNewPassword] = React.useState<string>('')
  const [members, setMembers] = React.useState<MemberSummary[]>([])
  const [membersError, setMembersError] = React.useState<string>('')
  const [isMaximized, setIsMaximized] = React.useState<boolean>(false)
  const [isLandscape, setIsLandscape] = React.useState<boolean>(() => window.innerWidth > window.innerHeight)
  const [isDashboardMenuVisible, setIsDashboardMenuVisible] = React.useState<boolean>(() => window.innerWidth > window.innerHeight)
  const [isWebPortraitMenuOpen, setIsWebPortraitMenuOpen] = React.useState(false)
  const dashboardMenuHideTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
  }, [])

  const apiFetch = React.useCallback(
    async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers ?? {})
      headers.set('Content-Type', 'application/json')

      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`)
      }

      const response = await fetch(url, {
        ...init,
        headers,
      })

      const payload = (await response.json()) as T & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? `Request failed (${response.status})`)
      }

      return payload
    },
    [authToken]
  )

  React.useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!authToken) {
        setAuthUser(null)
        return
      }

      try {
        const payload = await apiFetch<{ ok: boolean; user: AuthUser }>('/user/me')
        if (isMounted) {
          setAuthUser(payload.user)
          setChangeNameValue(payload.user.username)
        }
      } catch {
        if (isMounted) {
          setAuthUser(null)
          setAuthToken('')
          window.localStorage.removeItem('flypc-auth-token')
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [apiFetch, authToken])

  React.useEffect(() => {
    let isMounted = true

    const loadMembers = async () => {
      if (!authToken || authUser?.role !== 'Admin') {
        setMembers([])
        setMembersError('')
        return
      }

      try {
        const payload = await apiFetch<{ ok: boolean; members: MemberSummary[] }>('/user/members')
        if (isMounted) {
          setMembers(payload.members)
          setMembersError('')
        }
      } catch (error) {
        if (isMounted) {
          setMembers([])
          setMembersError(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void loadMembers()

    return () => {
      isMounted = false
    }
  }, [apiFetch, authToken, authUser?.role])

  React.useEffect(() => {
    if (layoutMode === 'dashboard') {
      setIsDashboardMenuVisible(isLandscape)
    }
  }, [layoutMode, isLandscape])

  React.useEffect(() => {
    return () => {
      if (dashboardMenuHideTimerRef.current !== null) {
        window.clearTimeout(dashboardMenuHideTimerRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!openedAccountsMenuArea) {
      return
    }

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-accounts-hub]')) {
        return
      }

      setOpenedAccountsMenuArea(null)
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer)
    }
  }, [openedAccountsMenuArea])

  React.useEffect(() => {
    let isMounted = true

    const loadApps = async () => {
      try {
        const payload = await apiFetch<AppEntry[]>('/apps/list')
        if (isMounted) {
          setApps(Array.isArray(payload) ? payload : [])
          setAppsError(null)
        }
      } catch (error) {
        if (isMounted) {
          setApps([])
          setAppsError(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void loadApps()

    return () => {
      isMounted = false
    }
  }, [apiFetch])

  const handleCloseAppWindow = (appKey: string) => {
    setOpenApps((current) => current.filter((app) => app.key !== appKey))
    setAppsListReturnWindowId((current) => current === `app:${appKey}` ? null : current)
    setActiveWindowId('apps')
    setIsMaximized(false)
  }

  const handleCloseWindow = () => {
    if (activeWindowId.startsWith('app:')) {
      handleCloseAppWindow(activeWindowId.slice(4))
      return
    }

    setIsMaximized(false)
    setActiveWindowId('apps')
  }

  const handleMinimizeWindow = () => {
    setIsMaximized(false)
    setActiveWindowId('apps')
  }

  const handleMaximizeWindow = () => {
    setIsMaximized((current) => !current)
  }

  const handleWindowChange = (windowId: WindowId) => {
    setOpenedAccountsMenuArea(null)

    if (windowId !== 'apps' && activeWindowId === windowId) {
      setAppsListReturnWindowId(windowId)
      setActiveWindowId('apps')
    } else if (activeWindowId === 'apps' && appsListReturnWindowId === windowId) {
      setAppsListReturnWindowId(null)
      setActiveWindowId(windowId)
    } else {
      setAppsListReturnWindowId(null)
      setActiveWindowId(windowId)
    }

    if (layoutMode === 'dashboard' && !isLandscape && isDashboardMenuVisible) {
      if (dashboardMenuHideTimerRef.current !== null) {
        window.clearTimeout(dashboardMenuHideTimerRef.current)
      }

      dashboardMenuHideTimerRef.current = window.setTimeout(() => {
        setIsDashboardMenuVisible(false)
        dashboardMenuHideTimerRef.current = null
      }, 500)
    }
  }

  const handleAppOpen = (app: AppEntry) => {
    setOpenApps((current) => {
      if (current.some((entry) => entry.key === app.key)) {
        return current
      }

      return [...current, app]
    })
    setAppsListReturnWindowId(null)
    setActiveWindowId(`app:${app.key}`)
  }

  const clearAccountFeedback = () => {
    setAccountMessage('')
    setAccountError('')
  }

  const handleLogin = async () => {
    clearAccountFeedback()
    try {
      const payload = await apiFetch<{ ok: boolean; token: string; user: AuthUser }>('/user/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      })

      setAuthToken(payload.token)
      setAuthUser(payload.user)
      setChangeNameValue(payload.user.username)
      window.localStorage.setItem('flypc-auth-token', payload.token)
      setAccountMessage('Logged in successfully.')
      setLoginPassword('')
      setAppSessionVersion((current) => current + 1)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleLoginRequest = () => {
    Modal.confirm({
      title: 'Refresh app sessions?',
      content: 'Signing in will refresh all currently opened app sessions. Do you want to proceed?',
      okText: 'Proceed and sign in',
      cancelText: 'Cancel',
      onOk: handleLogin,
    })
  }

  const handleLogout = async () => {
    clearAccountFeedback()
    try {
      await apiFetch<{ ok: boolean }>('/user/logout', { method: 'POST', body: JSON.stringify({}) })
    } catch {
      // Ignore logout failures and clear local auth state anyway.
    }

    setAuthToken('')
    setAuthUser(null)
    setMembers([])
    window.localStorage.removeItem('flypc-auth-token')
    setAccountMessage('Logged out.')
  }

  const handleChangeName = async () => {
    clearAccountFeedback()
    try {
      const payload = await apiFetch<{ ok: boolean; token: string; user: AuthUser }>('/user/change-name', {
        method: 'POST',
        body: JSON.stringify({ newUsername: changeNameValue }),
      })

      setAuthToken(payload.token)
      setAuthUser(payload.user)
      window.localStorage.setItem('flypc-auth-token', payload.token)
      setAccountMessage('Name updated successfully.')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleResetPassword = async () => {
    clearAccountFeedback()
    try {
      await apiFetch<{ ok: boolean }>('/user/reset-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      setCurrentPassword('')
      setNewPassword('')
      setAccountMessage('Password updated successfully.')
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : String(error))
    }
  }

  const handleLayoutModeChange = (mode: LayoutMode) => {
    dispatch(setLayoutMode(mode)) // optimistic update
    void updateSetting({ action: 'update', property: 'ui', value: mode })
  }

  const handleControlsSideChange = (side: 'left' | 'right') => {
    dispatch(setControlsSide(side))
    void updateSetting({ action: 'update', property: 'controlsSide', value: side })
  }

  const handleWallpaperChange = (id: number) => {
    dispatch(setWallpaper(id)) // optimistic update
    void updateSetting({ action: 'update', property: 'wallp', value: id })
  }

  const handleColorPaletteChange = (themeName: string) => {
    dispatch(setColorPalette(themeName)) // optimistic update
    void updateSetting({ action: 'update', property: 'colorPalette', value: themeName })
    const primary = ColorPalette.options[themeName as keyof typeof ColorPalette.options]?.[0]
    if (primary) {
      try {
        window.parent.postMessage({ type: 'FLYPC_THEME_CHANGED', themeName, primaryColor: primary }, '*')
      } catch {
        // ignore
      }
    }
  }

  React.useEffect(() => {
    if (!activeTheme) return
    const primary = ColorPalette.options[activeTheme as keyof typeof ColorPalette.options]?.[0]
    if (primary) {
      try {
        window.parent.postMessage({ type: 'FLYPC_THEME_CHANGED', themeName: activeTheme, primaryColor: primary }, '*')
      } catch {
        // ignore
      }
    }
  }, [activeTheme])

  const menuItems = [
    { key: 'apps', label: 'Apps', icon: <AppstoreOutlined /> },
    { key: 'monitor', label: 'Monitor', icon: <MonitorOutlined /> },
    { key: 'files', label: 'File Manager', icon: <FolderOpenOutlined /> },
    { key: 'terminal', label: 'Terminal', icon: <ThunderboltOutlined /> },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
  ]

  const accountSubmenuItems: Array<{ key: WindowId; label: string; icon: React.ReactNode }> = [
    { key: 'accounts', label: 'Accounts', icon: <UserOutlined /> },
    ...(authUser?.role === 'Admin' ? [{ key: 'members' as WindowId, label: 'Members', icon: <UserOutlined /> }] : []),
  ]

  const accountHubMenuItem = {
    key: 'account-hub',
    label: 'Accounts',
    icon: <UserOutlined />,
    subItems: accountSubmenuItems,
  }

  const isDashboard = layoutMode === 'dashboard'
  const isDesktop = layoutMode === 'desktop'
  const isHybrid = layoutMode === 'hybrid-console'
  const isSharp = layoutMode === 'sharp'
  const isWeb = layoutMode === 'web'
  const isDesktopLike = isDesktop || isHybrid || isSharp || isWeb
  const sidebarOnRight = !isLandscape && (isDashboard || isHybrid)
  const isAppsLauncherWindow = activeWindowId === 'apps'
  const isAppsShortcutView = !isDashboard && !isWeb && isAppsLauncherWindow && isDesktopLike
  const isShortcutSurface = isAppsShortcutView
  const desktopWindowHeight = isDesktop && isLandscape ? 'calc(100% - 75px)' : '100%'
  const isWindowMaximized = !isDashboard && isMaximized && (isDesktop || isHybrid || isSharp || isWeb)
  const shouldHideDashboardWindowArea = isDashboard && !isLandscape && isDashboardMenuVisible
  const activeAppKey = activeWindowId.startsWith('app:') ? activeWindowId.slice(4) : null
  const hasRightControlsOpen = Boolean(activeAppKey && openAppControls[activeAppKey] && controlsSide === 'right')
  const hasRightControls = Boolean(activeAppKey && controlsSide === 'right')
  const controlsPanelWidth = !isLandscape ? '100%' : isDesktop ? '30%' : '25%'
  const collapsedControlsPanelWidth = '2.5rem'
  const rightControlsHeaderWidth = hasRightControlsOpen ? controlsPanelWidth : collapsedControlsPanelWidth
  const titleBarHeight = '2.35rem'
  const primaryColor = primary || '#597ef7'
  const secondaryColor = secondary || '#85a5ff'
  const isWhitePalette = activeTheme === 'White'
  const useLightRightControlTitleButtons = isHybrid && hasRightControls
  const titleButtonIconColor = useLightRightControlTitleButtons ? '#ffffff' : '#334155'
  const titleButtonBackground = useLightRightControlTitleButtons ? 'transparent' : '#f1f5f9'
  const windowTitleColor = !useLightRightControlTitleButtons && isWhitePalette && hasRightControls
    ? '#4b5563'
    : hasRightControls || isWeb ? '#ffffff' : 'black'

  // Active tab label for the window title bar
  const activeLabel =
    activeWindowId.startsWith('app:')
      ? openApps.find((app) => `app:${app.key}` === activeWindowId)?.name ?? 'App'
      : activeWindowId === 'accounts'
        ? 'Accounts'
        : activeWindowId === 'members'
          ? 'Members'
          : menuItems.find((m) => m.key === activeWindowId)?.label ?? 'Console'
  const activeWindowIcon = activeWindowId.startsWith('app:')
    ? APP_ICON_MAP[openApps.find((app) => `app:${app.key}` === activeWindowId)?.icon ?? ''] ?? <AppstoreOutlined />
    : activeWindowId === 'accounts' || activeWindowId === 'members'
      ? <UserOutlined />
      : menuItems.find((item) => item.key === activeWindowId)?.icon ?? <AppstoreOutlined />
  const visibleMenuItems = [
    menuItems[0],
    menuItems[1],
    ...openApps.map((app) => ({ key: `app:${app.key}`, label: app.name, icon: APP_ICON_MAP[app.icon] ?? <AppstoreOutlined /> })),
    ...menuItems.slice(2, 4),
    accountHubMenuItem,
    ...menuItems.slice(4),
  ]
  const sidebarMenuItems = visibleMenuItems.filter((item) => item.key !== 'settings')
  const settingsMenuItem = menuItems.find((item) => item.key === 'settings')!
  const desktopTaskbarWidth = `min(calc(100vw - 3rem), ${Math.max(280, 65 + visibleMenuItems.length * 42)}px)`

  // Determine contrasting text colors dynamically
  const menuBarTextColor = getTextColor(primaryColor)
  const nonWebWhitePaletteMenuColor = isWhitePalette ? '#4b5563' : undefined
  const launcherApps = apps.map((app) => ({
    key: app.key,
    name: app.name,
    description: app.description,
    iconNode: APP_ICON_MAP[app.icon] ?? <AppstoreOutlined />,
    published: app.published,
    open: () => handleAppOpen(app),
  }))

  const toggleDesktopFullscreen = React.useCallback(() => {
    const hostWindow = (window.parent && window.parent !== window ? window.parent : window) as DesktopBridgeWindow
    void hostWindow.flypcDesktop?.toggleFullScreen?.()
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        color: '#0f172a', // Always use dark slate text default for readability on light/glass content cards
        fontFamily: 'var(--sans)',
      }}
    >
      {/* Header - Only visible in Dashboard mode */}
      {isDashboard && (
        <header
          style={{
            height: '60px',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo.png"
              alt="FlyPC"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 4px 10px rgba(0, 0, 0, 0.08)',
              }}
            />
            <span style={{ fontSize: '19px', color: '#0f172a' }}>
              {name || 'FlyPC'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                background: '#f1f5f9',
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              Console • Insite
            </span>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#e2e8f0',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.9rem',
                color: '#475569',
                fontWeight: 500,
              }}
            >
              AD
            </div>
          </div>
        </header>
      )}

      {/* Main Layout Area */}
      <div
        id="dash"
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: isDesktop || isWeb ? 'column' : (isDashboard || isHybrid) ? (isLandscape ? 'row' : 'row-reverse') : 'row',
          height: isDashboard ? 'calc(100% - 60px)' : '100%',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
          borderRadius: isDashboard ? '7px' : '0',
          border: isDashboard ? '1px solid rgba(0, 0, 0, 0.07)' : 'none',
          boxShadow: isDashboard ? '0 2px 8px rgba(15, 23, 42, 0.08)' : 'none',
          margin: isDashboard ? '0 10px 10px' : '0',
          padding: isSharp ? 'clamp(1rem, 4vw, 3rem) clamp(1rem, 6vw, 5rem) clamp(5.75rem, 9vw, 7rem)' : '0',
        }}
      >
        {isDashboard && (
          <button
            title={isDashboardMenuVisible ? 'Collapse menu' : 'Expand menu'}
            onClick={() => setIsDashboardMenuVisible((current) => !current)}
            style={{
              position: 'absolute',
              top: '0',
              left: isLandscape ? (isDashboardMenuVisible ? '192px' : '0') : 'auto',
              right: isLandscape ? 'auto' : isDashboardMenuVisible ? '192px' : '0',
              width: '38px',
              height: '38px',
              border: 'none',
              padding: 0,
              background: 'transparent',
              color: '#505050',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 8,
              transition: 'left 0.28s ease, right 0.28s ease, background-color 0.2s ease',
            }}
          >
            {isDashboardMenuVisible ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        )}

        {/* Menu on side - left in dashboard landscape, right in dashboard portrait, left rail in hybrid */}
        {(isDashboard || isHybrid) && (
          <aside
            id="menubar"
            style={{
              // Dashboard: full sidebar with text. Hybrid: icon-only narrow rail.
              width: isDashboard ? (isDashboardMenuVisible ? '192px' : '0px') : '61px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: isDashboard
                ? isDashboardMenuVisible
                  ? '1rem 0.75rem'
                  : '1rem 0'
                : '0.75rem 0.25rem',
              boxSizing: 'border-box',
              background: primaryColor,
              borderLeft: sidebarOnRight
                ? '1px solid rgba(255, 255, 255, 0.12)'
                : '1px solid transparent',
              borderRight: sidebarOnRight
                ? '1px solid transparent'
                : isDashboard && isLandscape
                  ? isDashboardMenuVisible
                    ? '1px solid rgba(0, 0, 0, 0.06)'
                    : '1px solid transparent'
                  : isDashboard
                    ? isDashboardMenuVisible
                      ? '1px solid rgba(0, 0, 0, 0.06)'
                      : '1px solid transparent'
                    : '1px solid rgba(255, 255, 255, 0.12)',
              zIndex: 5,
              overflow: 'visible',
              opacity: isDashboard && !isDashboardMenuVisible ? 0 : 1,
              pointerEvents: isDashboard && !isDashboardMenuVisible ? 'none' : 'auto',
              transition: 'width 0.28s ease, padding 0.28s ease, border-color 0.28s ease, opacity 0.16s ease',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: isHybrid ? '7px' : '0.25rem' }}>

              {sidebarMenuItems.map((item) => {
                const isAccountHubItem = item.key === 'account-hub'
                const isActive = isAccountHubItem ? activeWindowId === 'accounts' || activeWindowId === 'members' : activeWindowId === item.key
                const isUserAppItem = item.key.startsWith('app:')
                const showMenuClose = isDashboard && isUserAppItem && (isActive || hoveredClosableMenuKey === item.key)
                const showAccountsSubmenu = isAccountHubItem && openedAccountsMenuArea === 'sidebar'
                return (
                  <div
                    key={item.key}
                    data-accounts-hub={isAccountHubItem ? 'sidebar' : undefined}
                    style={{ position: 'relative' }}
                    onMouseEnter={() => {
                      if (isDashboard && isUserAppItem) {
                        setHoveredClosableMenuKey(item.key)
                      }
                    }}
                    onMouseLeave={() => {
                      if (hoveredClosableMenuKey === item.key) {
                        setHoveredClosableMenuKey(null)
                      }
                    }}
                  >
                    <button
                      title={item.label}
                      onClick={() => {
                        if (isAccountHubItem) {
                          setOpenedAccountsMenuArea((current) => (current === 'sidebar' ? null : 'sidebar'))
                          return
                        }
                        handleWindowChange(item.key as WindowId)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isDashboard ? 'flex-start' : 'center',
                        gap: isDashboard ? '0.5rem' : '0',
                        width: '100%',
                        height: undefined,
                        margin: undefined,
                        padding: isDashboard ? '0.45rem 0.65rem' : '0.5rem',
                        borderRadius: '7px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 400,
                        letterSpacing: '0.01em',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                        background: isActive ? secondaryColor : 'transparent',
                        color: nonWebWhitePaletteMenuColor ?? (isDashboard ? '#ffffff' : isActive ? '#ffffff' : `${menuBarTextColor}bb`),
                        boxShadow: 'none',
                      }}
                    >
                      <span style={{ fontSize: isDashboard ? '0.85rem' : isHybrid ? '17px' : '21px', flexShrink: 0, color: nonWebWhitePaletteMenuColor ?? '#ffffff' }}>{item.icon}</span>
                      {isDashboard && (
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                      )}
                      {isDashboard && isUserAppItem && (
                        <span
                          title="Close app"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleCloseAppWindow(item.key.slice(4))
                          }}
                          style={{
                            marginLeft: 'auto',
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            display: 'grid',
                            placeItems: 'center',
                            color: nonWebWhitePaletteMenuColor ?? '#ffffff',
                            opacity: showMenuClose ? 1 : 0,
                            pointerEvents: showMenuClose ? 'auto' : 'none',
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <CloseOutlined style={{ fontSize: '0.62rem' }} />
                        </span>
                      )}
                    </button>
                    {showAccountsSubmenu && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: sidebarOnRight
                            ? 'auto'
                            : isDashboard
                              ? 'calc(100% + 12px)'
                              : 'calc(100% + 8px)',
                          right: sidebarOnRight
                            ? isDashboard
                              ? 'calc(100% + 12px)'
                              : 'calc(100% + 8px)'
                            : 'auto',
                          transform: 'translateY(-50%)',
                          minWidth: '150px',
                          padding: '0.35rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: primaryColor,
                          boxShadow: '0 12px 26px rgba(15, 23, 42, 0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          zIndex: 15,
                        }}
                      >
                        {accountSubmenuItems.map((subItem) => (
                          <button
                            key={subItem.key}
                            title={subItem.label}
                            onClick={() => {
                              handleWindowChange(subItem.key)
                              setOpenedAccountsMenuArea(null)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              width: '100%',
                              padding: '0.42rem 0.58rem',
                              border: 'none',
                              borderRadius: '6px',
                              background: activeWindowId === subItem.key ? secondaryColor : 'transparent',
                              color: nonWebWhitePaletteMenuColor ?? '#ffffff',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{subItem.icon}</span>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              title={settingsMenuItem.label}
              onClick={() => handleWindowChange('settings')}
              style={{
                width: '100%',
                padding: isDashboard ? '0.45rem 0.65rem' : '0.5rem',
                borderRadius: '6px',
                border: 'none',
                background: activeWindowId === 'settings' ? secondaryColor : 'transparent',
                fontSize: '0.78rem',
                color: nonWebWhitePaletteMenuColor ?? '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isDashboard ? 'flex-start' : 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: isDashboard ? '0.85rem' : '15px', flexShrink: 0 }}>{settingsMenuItem.icon}</span>
              {isDashboard && <span>Settings</span>}
            </button>
          </aside>
        )}

        {isWeb && (
          <nav
            aria-label="Web layout navigation"
            style={{
              position: 'relative',
              height: '4.5rem',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLandscape ? 'center' : 'flex-end',
              gap: isLandscape ? '2.5rem' : 0,
              padding: isLandscape ? 0 : '0 1rem',
              boxSizing: 'border-box',
              borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '3rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              <img src="/logo.png" alt="FlyPC" style={{ width: '1.8rem', height: '1.8rem', objectFit: 'contain' }} />
              <span>FlyPC</span>
            </div>
            {isLandscape && [...menuItems, { key: 'accounts', label: 'Accounts' }].map((item) => {
              const isActive = activeWindowId === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => handleWindowChange(item.key as WindowId)}
                  style={{
                    height: '100%',
                    padding: '0 0.1rem',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${secondaryColor}` : '2px solid transparent',
                    background: 'transparent',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              )
            })}
            {!isLandscape && (
              <>
                <button
                  type="button"
                  aria-expanded={isWebPortraitMenuOpen}
                  aria-controls="web-portrait-menu"
                  onClick={() => setIsWebPortraitMenuOpen((open) => !open)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.5rem 0.7rem',
                    border: '1px solid rgba(255, 255, 255, 0.28)',
                    borderRadius: '4px',
                    background: '#ffffff12',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <span>{activeLabel}</span>
                  <span aria-hidden="true">▾</span>
                </button>
                {isWebPortraitMenuOpen && (
                  <div
                    id="web-portrait-menu"
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 0.35rem)',
                      right: '1rem',
                      minWidth: '10.5rem',
                      padding: '0.3rem',
                      border: '1px solid rgba(255, 255, 255, 0.22)',
                      borderRadius: '4px',
                      background: '#1f2939e8',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      zIndex: 20,
                    }}
                  >
                    {[...menuItems, { key: 'accounts', label: 'Accounts' }].map((item) => {
                      const isActive = activeWindowId === item.key
                      return (
                        <button
                          key={item.key}
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            handleWindowChange(item.key as WindowId)
                            setIsWebPortraitMenuOpen(false)
                          }}
                          style={{
                            width: '100%',
                            padding: '0.55rem 0.65rem',
                            border: 'none',
                            borderRadius: '3px',
                            background: isActive ? '#ffffff1f' : 'transparent',
                            color: '#ffffff',
                            fontSize: '0.78rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </nav>
        )}

        {/* Content View Area */}
        <main
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            padding: isDashboard || isHybrid || isWeb || isWindowMaximized || isShortcutSurface || isSharp ? '0' : '0.5rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isDashboard || isHybrid || isWeb || isWindowMaximized || isShortcutSurface || isSharp ? 'stretch' : 'center',
            justifyContent: 'flex-start',
            boxSizing: 'border-box',
            boxShadow: isHybrid ? '0 10px 24px rgba(15, 23, 42, 0.22)' : 'none',
            visibility: shouldHideDashboardWindowArea ? 'hidden' : 'visible',
          }}
        >
          {isWeb && (
            <div style={{ width: '100%', alignSelf: 'flex-start', boxSizing: 'border-box', padding: '2.25rem 3rem 1.25rem', color: '#ffffffa0', fontSize: 'clamp(0.9rem, 1.6875vw, 1.6875rem)', fontWeight: 500, letterSpacing: '-0.04em', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ display: 'grid', placeItems: 'center', fontSize: '1.125em', filter: 'brightness(0) invert(1)' }}>{activeWindowIcon}</span>
              <span>{activeLabel}</span>
            </div>
          )}
          <div
            id="window"
            onDoubleClick={toggleDesktopFullscreen}
            style={{
              position: isWindowMaximized ? 'fixed' : 'relative',
              inset: isWindowMaximized ? 0 : undefined,
              width: isShortcutSurface ? '100%' : isWindowMaximized ? '100vw' : isWeb ? isLandscape ? '95%' : '97%' : isDashboard || isHybrid || isSharp ? '100%' : 'min(100%, 1000px)',
              height: isShortcutSurface ? '100%' : isWindowMaximized ? '100vh' : isWeb ? 'calc(100% - 7.75rem)' : isDashboard || isHybrid ? '100%' : desktopWindowHeight,
              maxWidth: isShortcutSurface || isDashboard || isHybrid || isWeb || isSharp || isWindowMaximized ? 'none' : '1000px',
              alignSelf: isWeb || isDesktop ? 'center' : isShortcutSurface || isDashboard || isHybrid || isSharp || isWindowMaximized ? 'stretch' : 'stretch',
              background: isShortcutSurface
                ? 'transparent'
                : isDashboard
                  ? '#ffffff'
                  : isWeb
                    ? '#ffffff03'
                    : isSharp
                      ? 'rgba(255, 255, 255, 0.19)'
                      : 'rgba(255, 255, 255, 0.18)',
              backdropFilter: isShortcutSurface ? 'none' : isWeb ? 'blur(3px)' : 'blur(24px)',
              borderRadius: isWindowMaximized ? '0' : isWeb ? '10px' : isShortcutSurface || isDashboard || isHybrid || isSharp ? '0' : '5px',
              padding: '0',
              margin: isWeb && !isWindowMaximized ? '0 auto 1rem' : undefined,
              boxShadow: isShortcutSurface
                ? 'none'
                : isWindowMaximized
                  ? 'none'
                  : isDashboard
                    ? '0 2px 16px rgba(0,0,0,0.06)'
                    : isSharp
                      ? '0 16px 40px rgba(15, 23, 42, 0.15)'
                      : '0 16px 40px rgba(0, 0, 0, 0.18)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
              color: '#0f172a',
              overflow: 'hidden', // let inner content div scroll
            }}
          >
            {!isShortcutSurface && (
              <div
                id="title"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0',
                  background: hasRightControls || isWeb ? 'transparent' : 'rgba(255, 255, 255, 0.81)',
                  color: 'white',
                  overflow: 'hidden',
                  position: hasRightControls ? 'absolute' : 'relative',
                  top: hasRightControls ? 0 : undefined,
                  right: hasRightControls ? 0 : undefined,
                  width: hasRightControls ? rightControlsHeaderWidth : '100%',
                  height: titleBarHeight,
                  zIndex: hasRightControls ? 4 : undefined,
                  transition: 'width 260ms ease',
                  opacity: '0.8'
                }}
              >
                {activeAppKey && (
                  <Button
                    id="btn-controls"
                    title={openAppControls[activeAppKey] ? 'Hide controls' : 'Show controls'}
                    onClick={() => {
                      setOpenAppControls((current) => ({
                        ...current,
                        [activeAppKey]: !current[activeAppKey],
                      }))
                    }}
                    type="text"
                    icon={openAppControls[activeAppKey]
                      ? <MenuUnfoldOutlined style={{ fontSize: isHybrid ? '0.78rem' : '0.72rem' }} />
                      : <MenuFoldOutlined style={{ fontSize: isHybrid ? '0.78rem' : '0.72rem' }} />}
                    style={{
                      position: 'absolute',
                      zIndex: 1,
                      top: hasRightControls ? '50%' : undefined,
                      right: hasRightControls
                        ? '0'
                        : activeWindowId === 'apps' ? '4.5rem' : '6.75rem',
                      width: isHybrid ? '26px' : '32px',
                      height: isHybrid ? '26px' : '32px',
                      padding: '0',
                      borderRadius: '0',
                      border: 'none',
                      background: 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      boxShadow: 'none',
                      color: windowTitleColor,
                      transform: hasRightControls ? 'translateY(-50%)' : undefined,
                      transition: 'right 260ms ease, transform 260ms ease',
                      margin: '0px 7px',
                    }}
                  />
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  minWidth: 0,
                  minHeight: '100%',
                  padding: hasRightControls ? '4px 2.8rem 4px 0.85rem' : '4px 0.35rem',
                  boxSizing: 'border-box',
                  background: hasRightControls ? primaryColor : isWeb ? 'transparent' : 'rgba(255, 255, 255, 0.81)',
                  marginLeft: '0',
                  transition: 'width 260ms ease, margin-left 260ms ease',
                }}>
                  <span
                    style={{
                      display: isWeb || (hasRightControls && !hasRightControlsOpen) ? 'none' : 'block',
                      fontSize: '0.78rem',
                      fontWeight: 400,
                      letterSpacing: '0.03em',
                      textTransform: 'none',
                      userSelect: 'none',
                      color: windowTitleColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: '0 0.65rem'
                    }}
                  >
                    {activeLabel}
                  </span>
                  <div style={{
                    display: hasRightControls && !hasRightControlsOpen ? 'none' : 'flex',
                    marginLeft: 'auto',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px',
                    boxSizing: 'border-box',
                    borderRadius: '5rem',
                    background: 'transparent'
                  }}>
                    <Button
                      id="btn-min"
                      title="Minimise"
                      onClick={handleMinimizeWindow}
                      type="text"
                      icon={<MdMinimize style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
                      style={{
                        width: '26px',
                        height: '26px',
                        padding: '0',
                        borderRadius: '50%',
                        border: 'none',
                        background: titleButtonBackground,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        color: titleButtonIconColor,
                      }}
                    />
                    <Button
                      id="btn-full"
                      title="Fullscreen"
                      onClick={handleMaximizeWindow}
                      type="text"
                      icon={isMaximized
                        ? <FullscreenExitIcon style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />
                        : <FullscreenIcon style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
                      style={{
                        width: '26px',
                        height: '26px',
                        padding: '0',
                        borderRadius: '50%',
                        border: 'none',
                        background: titleButtonBackground,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        boxShadow: 'none',
                        color: titleButtonIconColor,
                      }}
                    />
                    {activeWindowId !== 'apps' && (
                      <Button
                        id="btn-close"
                        title="Close"
                        onClick={handleCloseWindow}
                        type="text"
                        icon={<MdClose style={{ fontSize: 'calc(2px + 0.8rem)', color: titleButtonIconColor }} />}
                        style={{
                          width: '26px',
                          height: '26px',
                          padding: '0',
                          borderRadius: '50%',
                          border: 'none',
                          background: titleButtonBackground,
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          boxShadow: 'none',
                          color: titleButtonIconColor,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Window content — scrollable */}
            <div id="client" className={isWeb ? 'web-native-content' : undefined} style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
              <NativeWindowContent isActive={activeWindowId === 'apps'} fillHeight={isAppsShortcutView}>
                {isWeb ? (
                  <WebAppCards
                    apps={launcherApps.map((app) => ({ key: app.key, name: app.name, description: app.description, icon: app.iconNode, onOpen: app.open }))}
                    isLandscape={isLandscape}
                  />
                ) : isAppsShortcutView ? (
                  <div
                    style={{
                      display: isLandscape && isDesktop ? 'flex' : 'grid',
                      flexDirection: isLandscape && isDesktop ? 'column' : undefined,
                      flexWrap: isLandscape && isDesktop ? 'wrap' : undefined,
                      alignContent: isLandscape && isDesktop ? 'flex-start' : undefined,
                      gridTemplateColumns: isLandscape
                        ? isDesktop
                          ? undefined
                          : 'repeat(auto-fill, minmax(92px, 1fr))'
                        : 'repeat(3, minmax(0, 1fr))',
                      gap: '1rem 0.8rem',
                      maxWidth: isLandscape && !isDesktop ? '780px' : '100%',
                      height: isLandscape && isDesktop ? '100%' : undefined,
                      overflowX: isLandscape && isDesktop ? 'auto' : undefined,
                      overflowY: isLandscape && isDesktop ? 'hidden' : undefined,
                    }}
                  >
                    {launcherApps.map((app) => {

                      return (
                        <Button
                          key={app.key}
                          onClick={app.open}
                          type="text"
                          className={isHybrid ? 'app-brick-btn app-brick-btn-hybrid' : 'app-brick-btn app-brick-btn-desktop'}
                          style={
                            isHybrid
                              ? hybridAppbrick
                              : {
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.4rem 0.25rem',
                                borderRadius: '10px',
                              }
                          }
                        >
                          <div
                            style={{
                              width: isHybrid ? '24px' : '56px',
                              height: isHybrid ? '24px' : '56px',
                              borderRadius: isHybrid ? '0' : '14px',
                              background: isHybrid ? 'transparent' : 'rgba(255,255,255,0.2)',
                              border: isHybrid ? 'none' : '1px solid rgba(255,255,255,0.25)',
                              color: '#334155',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: isHybrid ? '1rem' : '1.45rem',
                              backdropFilter: isHybrid ? 'none' : 'blur(3px)',
                            }}
                          >
                            <span style={{ filter: isAppsShortcutView ? 'saturate(0.65)' : 'none' }}>{app.iconNode}</span>
                          </div>
                          <div
                            style={{
                              fontSize: isHybrid ? '10px' : '0.78rem',
                              fontWeight: 400,
                              color: isHybrid ? '#0f172a' : '#ffffff',
                              textShadow: isHybrid ? 'none' : '0 1px 2px rgba(0,0,0,0.55)',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              marginTop: isHybrid ? '4px' : '0',
                            }}
                          >
                            {app.name}
                          </div>
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
                      Applications
                    </h2>
                    <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#64748b' }}>
                      Select an app to open its window. Contents will be added later.
                    </p>

                    {appsError && (
                      <div style={{ marginBottom: '1rem', color: '#b91c1c', fontSize: '0.75rem' }}>{appsError}</div>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isLandscape
                          ? 'repeat(auto-fit, minmax(180px, 1fr))'
                          : 'repeat(3, minmax(0, 1fr))',
                        gap: '0.75rem',
                      }}
                    >
                      {launcherApps.map((app) => {

                        return (
                          <Button
                            key={app.key}
                            onClick={app.open}
                            type="text"
                            className="app-card-btn"
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '1px solid rgba(0,0,0,0.08)',
                              background: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '0.65rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#f1f5f9',
                                color: '#334155',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '1.1rem',
                              }}
                            >
                              {app.iconNode}
                            </div>
                            <div style={{ width: '100%' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>{app.name}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                                {app.published ? 'Published' : 'Unpublished'}
                              </div>
                            </div>
                          </Button>
                        )
                      })}
                    </div>
                  </>
                )}
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'monitor'}>
                <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  System Health Overview
                </h2>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Monitoring physical node capacity and containers.
                </p>

                {/* Metrics Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem',
                  }}
                >
                  {[
                    { label: 'CPU Usage', val: '24%', sub: '2.4 GHz Avg' },
                    { label: 'Memory', val: '4.8 GB / 8 GB', sub: '60% Allocated' },
                    { label: 'Storage', val: '12.4 GB Free', sub: 'SSD Pool' },
                    { label: 'Isolated Pods', val: '4 Active', sub: 'Sandboxed' },
                  ].map((metric, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '12px',
                        background: isDashboard ? '#f8fafc' : 'rgba(0, 0, 0, 0.03)',
                        border: isDashboard
                          ? '1px solid #e2e8f0'
                          : '1px solid rgba(0, 0, 0, 0.06)',
                        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {metric.label}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', lineHeight: 1.2 }}>
                        {metric.val}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {metric.sub}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`,
                    color: '#475569',
                    fontSize: '0.75rem',
                    lineHeight: '1.5',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>Pro-Tip:</span> Switch to <span style={{ fontWeight: 500 }}>Settings</span> to adjust layouts, color schemes, and observe changes in realtime.
                </div>
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'files'} fillHeight noPadding>
                {activeWindowId === 'files' ? (
                  <FileExplorer
                    isLoggedIn={Boolean(authUser)}
                    onLoginRequired={() => setActiveWindowId('accounts')}
                  />
                ) : null}
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'terminal'}>
                <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>Container Shell</h2>
                <div
                  style={{
                    background: '#090d16',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    fontFamily: 'var(--mono)',
                    fontSize: '0.9rem',
                    color: '#4af626',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    border: '1px solid #1e293b',
                    height: '240px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ color: '#888', marginBottom: '0.5rem' }}>FlyPC Container OS v1.0.0 (x86_64-pc-linux)</div>
                  <div>$ flypc list-pods</div>
                  <div style={{ color: '#fff', margin: '0.2rem 0 0.5rem' }}>
                    pod-0 (Notes)           - RUNNING (pid: 140)<br />
                    pod-1 (Coderun-Lite)    - RUNNING (pid: 145)<br />
                    pod-2 (System-Monitor)  - RUNNING (pid: 152)
                  </div>
                  <div>$ echo "Theme active: {activeTheme}"</div>
                  <div style={{ color: '#fff', margin: '0.25rem 0' }}>Theme active: {activeTheme}</div>
                  <div style={{ display: 'inline-block', width: '8px', height: '15px', background: '#4af626', verticalAlign: 'middle', animation: 'pulse 1s infinite' }} />
                </div>
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'accounts'}>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Accounts
                </h2>
                <p style={{ margin: '0 0 1.1rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Login, reset password, and change your account name.
                </p>

                {accountError && <div style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.78rem' }}>{accountError}</div>}
                {accountMessage && <div style={{ color: '#166534', marginBottom: '0.75rem', fontSize: '0.78rem' }}>{accountMessage}</div>}

                {!authUser ? (
                  <div style={{ maxWidth: '460px', display: 'grid', gap: '0.7rem' }}>
                    <label style={{ fontSize: '0.78rem', color: '#334155' }}>
                      Username
                      <Input
                        value={loginUsername}
                        onChange={(event) => setLoginUsername(event.target.value)}
                        style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </label>
                    <label style={{ fontSize: '0.78rem', color: '#334155' }}>
                      Password
                      <Input.Password
                        value={loginPassword}
                        onChange={(event) => setLoginPassword(event.target.value)}
                        style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <Button
                        onClick={handleLoginRequest}
                        type="primary"
                        style={{ padding: '0.55rem 0.9rem', borderRadius: '8px', border: 'none', background: primaryColor, color: '#fff', cursor: 'pointer' }}
                      >
                        Login
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div style={{ maxWidth: '640px', display: 'grid', gap: '1rem' }}>
                    <div style={{ padding: '0.8rem 0.9rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                      Signed in as <strong>{authUser.username}</strong> ({authUser.role})
                    </div>

                    <div style={{ padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '0.55rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>Name Change</h3>
                      <Input
                        value={changeNameValue}
                        onChange={(event) => setChangeNameValue(event.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <Button
                        onClick={handleChangeName}
                        type="primary"
                        style={{ width: 'fit-content', padding: '0.5rem 0.85rem', borderRadius: '8px', border: 'none', background: secondaryColor, color: '#fff', cursor: 'pointer' }}
                      >
                        Update Name
                      </Button>
                    </div>

                    <div style={{ padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '0.55rem' }}>
                      <h3 style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>Password Reset</h3>
                      <Input.Password
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <Input.Password
                        placeholder="New password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      />
                      <Button
                        onClick={handleResetPassword}
                        type="primary"
                        style={{ width: 'fit-content', padding: '0.5rem 0.85rem', borderRadius: '8px', border: 'none', background: secondaryColor, color: '#fff', cursor: 'pointer' }}
                      >
                        Reset Password
                      </Button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {authUser.role === 'Admin' && (
                        <Button
                          onClick={() => setActiveWindowId('members')}
                          style={{ padding: '0.52rem 0.82rem', borderRadius: '8px', border: '1px solid #94a3b8', background: '#fff', color: '#1e293b', cursor: 'pointer' }}
                        >
                          Members
                        </Button>
                      )}
                      <Button
                        onClick={handleLogout}
                        danger
                        style={{ padding: '0.52rem 0.82rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
                      >
                        Logout
                      </Button>
                    </div>
                  </div>
                )}
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'members'}>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Members
                </h2>
                <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Admin view of registered users and app/storage usage.
                </p>

                {membersError && <div style={{ marginBottom: '0.7rem', color: '#b91c1c', fontSize: '0.78rem' }}>{membersError}</div>}

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Username</th>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Created</th>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Apps</th>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Storage</th>
                        <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Usage % (100 MB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.id}>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.username}</td>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.role}</td>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{new Date(member.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.apps.length ? member.apps.join(', ') : '-'}</td>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{formatBytes(member.totalStorageBytes)}</td>
                          <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.usagePercent.toFixed(2)}%</td>
                        </tr>
                      ))}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0.9rem', textAlign: 'center', color: '#64748b' }}>
                            No members available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'settings'}>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>System Configuration</h2>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Manage the interface layout and color themes in real-time.
                </p>

                {/* Layout Mode Toggles */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.72rem', marginBottom: '0.5rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                    Layout Mode
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {(['desktop', 'dashboard', 'hybrid-console', 'sharp', 'web'] as LayoutMode[]).map((mode) => (
                      <Button
                        key={mode}
                        onClick={() => handleLayoutModeChange(mode)}
                        type="text"
                        style={{
                          padding: '0.6rem 1.2rem',
                          borderRadius: '8px',
                          border: layoutMode === mode
                            ? `2px solid ${primaryColor}`
                            : '1px solid rgba(0,0,0,0.15)',
                          background: layoutMode === mode
                            ? `${primaryColor}15`
                            : 'transparent',
                          color: layoutMode === mode
                            ? primaryColor
                            : '#475569',
                          fontWeight: 400,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s',
                        }}
                      >
                        {mode.replace('-', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.72rem', marginBottom: '0.5rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                    Application Controls
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {(['left', 'right'] as const).map((side) => (
                      <Button
                        key={side}
                        onClick={() => handleControlsSideChange(side)}
                        type="text"
                        style={{
                          padding: '0.6rem 1.2rem',
                          borderRadius: '8px',
                          border: controlsSide === side ? `2px solid ${primaryColor}` : '1px solid rgba(0,0,0,0.15)',
                          background: controlsSide === side ? `${primaryColor}15` : 'transparent',
                          color: controlsSide === side ? primaryColor : '#475569',
                          fontWeight: 400,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s',
                        }}
                      >
                        {side}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Color Palette Option Toggles */}
                <div>
                  <h3 style={{ fontSize: '0.72rem', marginBottom: '0.5rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
                    Color Palette
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isLandscape ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                      gap: '0.5rem',
                    }}
                  >
                    {Object.keys(ColorPalette.options).map((themeName) => {
                      const isActive = activeTheme === themeName
                      const themeColors = ColorPalette.options[themeName as keyof typeof ColorPalette.options]
                      return (
                        <Button
                          key={themeName}
                          onClick={() => handleColorPaletteChange(themeName)}
                          type="text"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            border: isActive
                              ? `2px solid ${themeColors[0]}`
                              : '1px solid rgba(0,0,0,0.08)',
                            background: isActive
                              ? `${themeColors[0]}15`
                              : 'rgba(0,0,0,0.02)',
                            color: '#334155',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ fontWeight: 400 }}>{themeName}</span>
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: themeColors[0],
                              border: '1px solid rgba(255,255,255,0.3)',
                            }}
                          />
                        </Button>
                      )
                    })}
                  </div>
                </div>

                {!isDashboard && (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      width: isLandscape ? '30vw' : '100%',
                      maxWidth: '100%',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      ['--wallpaper-accent' as string]: primaryColor,
                    }}
                  >
                    {/* Wallpaper Picker */}
                    <h3 style={{ fontSize: '0.72rem', marginBottom: '0.5rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, alignSelf: 'flex-start' }}>
                      Wallpaper
                    </h3>

                    {/* Active wallpaper preview */}
                    <div style={{ marginBottom: 0, width: '100%' }}>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>Active</p>
                      <div
                        style={{
                          width: '100%',
                          height: '160px',
                          borderRadius: 0,
                          overflow: 'hidden',
                          border: 'none',
                          boxShadow: 'none',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={`/resources/vx-${activeWallp}.webp`}
                          alt={`Wallpaper ${activeWallp}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '10px',
                            background: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(6px)',
                            color: '#fff',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 0,
                            fontWeight: 500,
                          }}
                        >
                          vx-{activeWallp}
                        </div>
                      </div>
                    </div>

                    {/* Wallpaper thumbnail grid */}
                    <div
                      className="wallpaper-scroll"
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: '4px',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        padding: '2px 0',
                      }}
                    >
                      {WALLPAPER_IDS.filter((id) => id !== activeWallp).map((id) => (
                        <Button
                          key={id}
                          onClick={() => handleWallpaperChange(id)}
                          title={`vx-${id}`}
                          type="text"
                          style={{
                            flex: '0 0 auto',
                            width: '110px',
                            padding: 0,
                            border: '2px solid transparent',
                            borderRadius: 0,
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: 'none',
                            transition: 'border-color 0.2s, transform 0.2s',
                            height: '67px',
                            display: 'block',
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = primaryColor
                            e.currentTarget.style.transform = 'scale(1.04)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent'
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        >
                          <img
                            src={`/resources/vx-${id}.webp`}
                            alt={`Wallpaper ${id}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '5px',
                              background: 'rgba(0,0,0,0.5)',
                              color: '#fff',
                              fontSize: '0.65rem',
                              padding: '0.1rem 0.3rem',
                              borderRadius: 0,
                            }}
                          >
                            vx-{id}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </NativeWindowContent>
              {openApps.map((app) => (
                <div
                  key={app.key}
                  style={{
                    display: activeWindowId === `app:${app.key}` ? 'block' : 'none',
                    width: '100%',
                    height: '100%',
                    minHeight: '420px',
                  }}
                >
                  <AppWindow
                    key={`${app.key}-${appSessionVersion}`}
                    appKey={app.key}
                    appName={app.name}
                    controlsOpen={Boolean(openAppControls[app.key])}
                    controlsSide={controlsSide}
                    controlsWidth={controlsPanelWidth}
                    titleBarHeight={titleBarHeight}
                    transparentControls={isDesktop}
                    showControlsBorder={isDashboard}
                  />
                </div>
              ))}
            </div>{/* end window content */}
          </div>
        </main>

        {/* Bottom task bar for Desktop and Sharp layouts */}
        {(isDesktop || isSharp) && (
          <footer
            id="menubar"
            style={{
              display: isWindowMaximized ? 'none' : 'flex',
              position: 'absolute',
              bottom: isSharp ? 'clamp(1rem, 3.5vw, 2.5rem)' : '18px',
              left: isSharp ? 'clamp(1rem, 6vw, 5rem)' : '50%',
              right: isSharp ? 'clamp(1rem, 6vw, 5rem)' : 'auto',
              width: isSharp ? undefined : desktopTaskbarWidth,
              transform: isSharp ? 'none' : 'translateX(-50%)',
              height: isSharp ? '40px' : '48px',
              padding: isSharp ? '0' : '0 0.45rem',
              alignItems: 'center',
              justifyContent: isSharp ? 'flex-start' : 'center',
              gap: isSharp ? '0.2rem' : '0.35rem',
              background: primaryColor,
              borderRadius: isSharp ? '0' : '14px',
              border: isSharp ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.22)',
              zIndex: 10,
              overflow: 'visible',
              maxWidth: 'calc(100vw - 3rem)',
              opacity: 0.91,
              backdropFilter: 'blur(7px)',
            }}
          >
            {visibleMenuItems.map((item) => {
              const isAccountHubItem = item.key === 'account-hub'
              const isActive = isAccountHubItem ? activeWindowId === 'accounts' || activeWindowId === 'members' : activeWindowId === item.key
              const showAccountsSubmenu = isAccountHubItem && openedAccountsMenuArea === 'footer'
              return (
                <div
                  key={item.key}
                  data-accounts-hub={isAccountHubItem ? 'footer' : undefined}
                  style={{
                    position: 'relative',
                    flexShrink: 0,
                    marginLeft: item.key === 'settings' ? 'auto' : undefined,
                  }}
                >
                  <button
                    onClick={() => {
                      if (isAccountHubItem) {
                        setOpenedAccountsMenuArea((current) => (current === 'footer' ? null : 'footer'))
                        return
                      }
                      handleWindowChange(item.key as WindowId)
                    }}
                    title={item.label}
                    style={{
                      width: isSharp ? 'auto' : '36px',
                      height: isSharp ? '42px' : '36px',
                      padding: isSharp ? '0 0.8rem' : 0,
                      borderRadius: isSharp ? '0' : '9px',
                      border: 'none',
                      flexShrink: 0,
                      background: isActive ? secondaryColor : 'transparent',
                      color: nonWebWhitePaletteMenuColor ?? '#ffffff',
                      fontSize: isSharp ? '0.76rem' : '1rem',
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: isSharp ? 'auto auto' : undefined,
                      gap: isSharp ? '0.45rem' : 0,
                      placeItems: 'center',
                      transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                      boxShadow: isActive ? `0 4px 14px ${secondaryColor}55` : 'none',
                    }}
                  >
                    {item.icon}
                    {isSharp && <span>{item.label}</span>}
                  </button>
                  {showAccountsSubmenu && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 12px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        minWidth: '155px',
                        padding: '0.35rem',
                        borderRadius: isSharp ? '0' : '9px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: primaryColor,
                        boxShadow: '0 14px 28px rgba(15, 23, 42, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                        zIndex: 20,
                      }}
                    >
                      {accountSubmenuItems.map((subItem) => (
                        <button
                          key={subItem.key}
                          title={subItem.label}
                          onClick={() => {
                            handleWindowChange(subItem.key)
                            setOpenedAccountsMenuArea(null)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            width: '100%',
                            padding: '0.42rem 0.56rem',
                            border: 'none',
                            borderRadius: isSharp ? '0' : '6px',
                            background: activeWindowId === subItem.key ? secondaryColor : 'transparent',
                            color: nonWebWhitePaletteMenuColor ?? '#ffffff',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>{subItem.icon}</span>
                          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subItem.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </footer>
        )}
      </div>
    </div>
  )
}

export default Dashboard
