import React from 'react'
import type { AppEntry, WindowId } from '../types/dashboard'
import type { LayoutMode } from '../store/settingsSlice'

type UseWindowManagerOptions = {
  layoutMode: LayoutMode
  isLandscape: boolean
  isDashboardMenuVisible: boolean
  setIsDashboardMenuVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export const useWindowManager = ({
  layoutMode,
  isLandscape,
  isDashboardMenuVisible,
  setIsDashboardMenuVisible,
}: UseWindowManagerOptions) => {
  const [activeWindowId, setActiveWindowId] = React.useState<WindowId>('apps')
  const [appsListReturnWindowId, setAppsListReturnWindowId] = React.useState<WindowId | null>(null)
  const [openApps, setOpenApps] = React.useState<AppEntry[]>([])
  const [appSessionVersions, setAppSessionVersions] = React.useState<Record<string, number>>({})
  const [openAppControls, setOpenAppControls] = React.useState<Record<string, boolean>>({})
  const [isMaximized, setIsMaximized] = React.useState(false)
  const dashboardMenuHideTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (dashboardMenuHideTimerRef.current !== null) {
        window.clearTimeout(dashboardMenuHideTimerRef.current)
      }
    }
  }, [])

  const handleCloseAppWindow = React.useCallback((appKey: string) => {
    void import('../apps/App')
      .then(({ App }) => new App(appKey).pause())
      .catch(() => {
        // Pause is best-effort; unmount hook also attempts pause for session containers.
      })

    setOpenApps((current) => current.filter((app) => app.key !== appKey))
    setAppsListReturnWindowId((current) => (current === `app:${appKey}` ? null : current))
    setActiveWindowId('apps')
    setIsMaximized(false)
  }, [])

  const handleCloseWindow = React.useCallback(() => {
    if (activeWindowId.startsWith('app:')) {
      handleCloseAppWindow(activeWindowId.slice(4))
      return
    }

    setIsMaximized(false)
    setActiveWindowId('apps')
  }, [activeWindowId, handleCloseAppWindow])

  const handleMinimizeWindow = React.useCallback(() => {
    setIsMaximized(false)
    setActiveWindowId('apps')
  }, [])

  const handleMaximizeWindow = React.useCallback(() => {
    setIsMaximized((current) => !current)
  }, [])

  const handleWindowChange = React.useCallback((windowId: WindowId) => {
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
  }, [activeWindowId, appsListReturnWindowId, isDashboardMenuVisible, isLandscape, layoutMode, setIsDashboardMenuVisible])

  const handleAppOpen = React.useCallback((app: AppEntry) => {
    setOpenApps((current) => {
      if (current.some((entry) => entry.key === app.key)) {
        return current
      }

      return [...current, app]
    })
    setAppsListReturnWindowId(null)
    setActiveWindowId(`app:${app.key}`)
  }, [])

  const refreshAppSession = React.useCallback((appKey: string) => {
    setAppSessionVersions((current) => ({
      ...current,
      [appKey]: (current[appKey] ?? 0) + 1,
    }))
  }, [])

  const refreshAllAppSessions = React.useCallback(() => {
    setAppSessionVersions((current) => {
      const next = { ...current }
      for (const app of openApps) {
        next[app.key] = (next[app.key] ?? 0) + 1
      }
      return next
    })
  }, [openApps])

  return {
    activeWindowId,
    openApps,
    appSessionVersions,
    openAppControls,
    setOpenAppControls,
    isMaximized,
    handleCloseAppWindow,
    handleCloseWindow,
    handleMinimizeWindow,
    handleMaximizeWindow,
    handleWindowChange,
    handleAppOpen,
    refreshAppSession,
    refreshAllAppSessions,
    setActiveWindowId,
  }
}
