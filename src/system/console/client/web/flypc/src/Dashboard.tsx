import React from 'react'
import { Button } from 'antd'
import { useAppSelector, useAppDispatch } from './store/hooks'
import { setLayoutMode, setWallpaper, setWindowLayout, pickRandomColorPalette, pickRandomLayoutMode, type LayoutMode, type WindowLayout } from './store/settingsSlice'
import { pickRandomWallpaperId } from './utils/wallpapers'
import { setColorPalette } from './store/themeSlice'
import { ColorPalette } from './globals/ColorPalette'
import { useUpdateSettingMutation } from './store/settingsApi'
import { useGetAppsListQuery } from './store/appsApi'
import { AppWindow } from './components/AppWindow'
import { MainContextMenu } from './components/context/MainContextMenu'
import { FileExplorer } from './components/FileExplorer'
import { NativeWindowContent } from './components/NativeWindowContent'
import { SystemSettingsPanel } from './components/SystemSettingsPanel'
import { DesktopTaskbar } from './components/DesktopTaskbar'
import { WebAppCards } from './components/WebAppCards'
import { MonitorView } from './components/views/MonitorView'
import { TerminalView } from './components/views/TerminalView'
import { AccountsView } from './components/views/AccountsView'
import { MembersView } from './components/views/MembersView'
import { SidebarNav } from './components/navigation/SidebarNav'
import { WebLayoutNav } from './components/navigation/WebLayoutNav'
import { SolidSlateNav } from './components/navigation/SolidSlateNav'
import { WindowChrome } from './components/window/WindowChrome'
import { useAuth } from './hooks/useAuth'
import { useWindowManager } from './hooks/useWindowManager'
import { useFullscreenWindowSwitcher } from './hooks/useFullscreenWindowSwitcher'
import { useLayoutContext } from './hooks/useLayoutContext'
import { renderAppIcon, withMenuIconColor } from './utils/menuIcons'
import { DESKTOP_WINDOW_MAX_WIDTH_PX } from './utils/windowLayout'
import { reloadPage } from './utils/reloadPage'
import type { WindowId } from './types/dashboard'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'

type DesktopBridgeWindow = Window & {
  flypcDesktop?: {
    toggleFullScreen?: () => Promise<boolean>
  }
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
  gap: '6px',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 8,
  padding: '12px 8px 10px',
  fontSize: '12px',
  textAlign: 'center',
  background: '#ffffffca',
  backdropFilter: 'blur(7px)',
  width: 'calc(3.35rem + 3px)',
  height: 'calc(4.15rem + 3px)',
  boxShadow: '0 2px 10px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.08)',
  boxSizing: 'border-box',
  flexShrink: 0,
}

const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch()
  const [updateSetting] = useUpdateSettingMutation()

  const { name, ui: layoutMode, windowLayout, wallp: activeWallp } = useAppSelector((state) => state.settings)
  const { activeTheme, primary, secondary } = useAppSelector((state) => state.theme)

  const [hoveredClosableMenuKey, setHoveredClosableMenuKey] = React.useState<string | null>(null)
  const [openedAccountsMenuArea, setOpenedAccountsMenuArea] = React.useState<'sidebar' | 'footer' | null>(null)
  const sidebarAccountHubRef = React.useRef<HTMLDivElement>(null)
  const [isLandscape, setIsLandscape] = React.useState<boolean>(() => window.innerWidth > window.innerHeight)
  const [isDashboardMenuVisible, setIsDashboardMenuVisible] = React.useState<boolean>(() => window.innerWidth > window.innerHeight)
  const [isWebPortraitMenuOpen, setIsWebPortraitMenuOpen] = React.useState(false)

  const {
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
    exitWindowMaximize,
    handleWindowChange: changeWindow,
    handleAppOpen,
    focusWindow,
    refreshAllAppSessions,
    pauseAllOpenApps,
    setActiveWindowId,
  } = useWindowManager({
    layoutMode,
    isLandscape,
    isDashboardMenuVisible,
    setIsDashboardMenuVisible,
  })

  const {
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
    handleLogoutRequest,
    handleChangeName,
    handleResetPassword,
  } = useAuth({
    onLoginSuccess: () => {
      refreshAllAppSessions()
      setActiveWindowId('apps')
    },
    pauseOpenApps: pauseAllOpenApps,
  })

  const { data: apps = [], error: appsQueryError } = useGetAppsListQuery()
  const appsError = appsQueryError
    ? 'error' in appsQueryError
      ? String(appsQueryError.error)
      : 'Unable to load apps'
    : null

  React.useEffect(() => {
    const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', updateOrientation)
    return () => window.removeEventListener('resize', updateOrientation)
  }, [])

  React.useEffect(() => {
    if (layoutMode === 'dashboard') {
      setIsDashboardMenuVisible(isLandscape)
    }
  }, [layoutMode, isLandscape])

  React.useEffect(() => {
    if (!openedAccountsMenuArea) {
      return
    }

    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-accounts-hub]') || target?.closest('[data-accounts-submenu]')) {
        return
      }

      setOpenedAccountsMenuArea(null)
    }

    document.addEventListener('mousedown', handleOutsidePointer)
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointer)
    }
  }, [openedAccountsMenuArea])

  const handleWindowChange = React.useCallback((windowId: WindowId) => {
    setOpenedAccountsMenuArea(null)
    changeWindow(windowId)
  }, [changeWindow])

  useFullscreenWindowSwitcher({
    activeWindowId,
    openApps,
    includeMembers: authUser?.role === 'Admin',
    onFocusWindow: focusWindow,
  })

  const layout = useLayoutContext({
    layoutMode,
    activeTheme,
    primary,
    secondary,
    windowLayout,
    activeWindowId,
    openApps,
    openAppControls,
    isMaximized,
    isLandscape,
    authUser,
  })

  const {
    accountSubmenuItems,
    showAccountSubmenu,
    isDashboard,
    isDesktop,
    isHybrid,
    isSharp,
    isWeb,
    isSolidSlate,
    isDark,
    sidebarOnRight,
    isAppsShortcutView,
    isShortcutSurface,
    desktopWindowHeight,
    desktopTaskbarHeightPx,
    isWindowMaximized,
    activeAppKey,
    controlsSide,
    titleBarStyle,
    hasPartialTitleBar,
    partialTitleSide,
    hasPartialControlsOpen,
    controlsPanelWidth,
    partialControlsHeaderWidth,
    titleBarHeight,
    partialTitleBarBackground,
    collapsedControlStripBackground,
    useThemedCollapsedControlStrip,
    webChromeSurface,
    controlPaneSurface,
    desktopChromeSurface,
    desktopBackdropBlur,
    primaryColor,
    secondaryColor,
    isWhitePalette,
    whitePaletteChromeColor,
    useLightTitleBar,
    titleButtonIconColor,
    windowTitleColor,
    activeLabel,
    activeWindowIcon,
    visibleMenuItems,
    sidebarMenuItems,
    settingsMenuItem,
    webPrimaryNavItems,
    getMenuItemColor,
    solidSlateIconColor,
    solidSlateTopBarColor,
    solidSlateBackdropColor,
    solidSlateLabelColor,
    darkIconColor,
    darkDockActiveBackground,
    darkBrickBackground,
    darkTitleButtonBackground,
  } = layout

  React.useEffect(() => {
    if (!showAccountSubmenu) {
      setOpenedAccountsMenuArea(null)
    }
  }, [showAccountSubmenu])

  const shouldHideDashboardWindowArea = false

  const renderWindowChrome = (embeddedInPane = false) => (
    <WindowChrome
      embeddedInPane={embeddedInPane}
      hasPartialTitleBar={hasPartialTitleBar}
      partialTitleSide={partialTitleSide}
      hasPartialControlsOpen={hasPartialControlsOpen}
      useLightTitleBar={useLightTitleBar}
      partialControlsHeaderWidth={partialControlsHeaderWidth}
      titleBarHeight={titleBarHeight}
      activeAppKey={activeAppKey}
      openAppControls={openAppControls}
      isHybrid={isHybrid}
      isWeb={isWeb}
      activeWindowId={activeWindowId}
      activeLabel={activeLabel}
      windowTitleColor={windowTitleColor}
      titleButtonIconColor={titleButtonIconColor}
      titleBarBackground={partialTitleBarBackground}
      isMaximized={isMaximized}
      onToggleAppControls={(appKey) => {
        setOpenAppControls((current) => ({
          ...current,
          [appKey]: !current[appKey],
        }))
      }}
      onMinimize={handleMinimizeWindow}
      onMaximize={handleMaximizeWindow}
      onClose={handleCloseWindow}
    />
  )

  const handleLayoutModeChange = (mode: LayoutMode) => {
    dispatch(setLayoutMode(mode)) // optimistic update
    void updateSetting({ action: 'update', property: 'ui', value: mode })
  }

  const handleWindowLayoutChange = (layout: WindowLayout) => {
    dispatch(setWindowLayout(layout))
    void updateSetting({ action: 'update', property: 'windowLayout', value: layout })
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

  const desktopAppIconColor = 'rgba(255, 255, 255, 0.95)'

  const launcherApps = apps.map((app) => ({
    key: app.key,
    name: app.name,
    description: app.description,
    iconNode: renderAppIcon(app.icon, isDesktop ? desktopAppIconColor : undefined),
    published: app.published,
    open: () => handleAppOpen(app),
  }))

  const toggleDesktopFullscreen = React.useCallback(() => {
    const hostWindow = (window.parent && window.parent !== window ? window.parent : window) as DesktopBridgeWindow
    void hostWindow.flypcDesktop?.toggleFullScreen?.()
  }, [])

  const handleRandomWallpaper = () => {
    handleWallpaperChange(pickRandomWallpaperId(activeWallp))
  }

  const handleRandomLayout = () => {
    handleLayoutModeChange(pickRandomLayoutMode(layoutMode))
  }

  const handleRandomColorPalette = () => {
    handleColorPaletteChange(pickRandomColorPalette(activeTheme))
  }

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
      {isDashboard && !isWindowMaximized && (
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
              src="/logo.png?v=4"
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
      <MainContextMenu
        isLandscape={isLandscape}
        isLoggedIn={Boolean(authUser)}
        layoutMode={layoutMode}
        activeTheme={activeTheme}
        activeWallp={activeWallp}
        primaryColor={primaryColor}
        loginUsername={loginUsername}
        loginPassword={loginPassword}
        accountError={accountError}
        onLoginUsernameChange={setLoginUsername}
        onLoginPasswordChange={setLoginPassword}
        onLoginSubmit={() => { void handleLogin() }}
        onLogin={() => setActiveWindowId('accounts')}
        onLogout={handleLogoutRequest}
        onWallpaperChange={handleWallpaperChange}
        onLayoutModeChange={handleLayoutModeChange}
        onColorPaletteChange={handleColorPaletteChange}
        onRandomWallpaper={handleRandomWallpaper}
        onRandomLayout={handleRandomLayout}
        onRandomColorPalette={handleRandomColorPalette}
        onEnterPageFullscreen={exitWindowMaximize}
        onReload={async () => {
          await pauseAllOpenApps()
          await reloadPage()
        }}
      >
      <div
        id="dash"
        className={
          isSolidSlate
            ? `layout-solid-slate${isWhitePalette ? ' layout-solid-slate--white' : ''}`
            : isDark
              ? `layout-dark${isWhitePalette ? ' layout-dark--white' : ''}`
              : isWeb
                ? 'layout-web'
              : isHybrid
              ? [
                  'layout-hybrid-console',
                  !isAppsShortcutView ? 'layout-hybrid-console--joined' : '',
                  sidebarOnRight ? 'layout-hybrid-console--menubar-right' : 'layout-hybrid-console--menubar-left',
                ].filter(Boolean).join(' ')
              : isDesktop
                ? 'layout-desktop'
              : undefined
        }
        style={{
          ...(isSolidSlate
            ? {
                ['--solid-slate-primary' as string]: primaryColor,
                ['--solid-slate-topbar' as string]: solidSlateTopBarColor,
                ['--solid-slate-icon' as string]: solidSlateIconColor,
                ['--solid-slate-backdrop' as string]: solidSlateBackdropColor,
                ['--solid-slate-label' as string]: solidSlateLabelColor,
                ['--control-pane-surface' as string]: controlPaneSurface,
              }
            : isDark
              ? {
                  ['--dark-primary' as string]: darkTitleButtonBackground,
                  ['--dark-title-button-bg' as string]: darkTitleButtonBackground,
                  ['--dark-brick-surface' as string]: darkBrickBackground,
                  ['--dark-dock-active-bg' as string]: darkDockActiveBackground,
                  ['--dark-dock-active-icon' as string]: darkDockActiveBackground,
                  ['--dark-icon' as string]: darkIconColor,
                  ['--dark-title-bar' as string]: 'rgba(255, 255, 255, 0.06)',
                  ['--dark-surface' as string]: 'rgba(22, 24, 28, 0.88)',
                  ['--dark-surface-border' as string]: 'rgba(255, 255, 255, 0.12)',
                }
              : isWeb
                ? {
                    ['--web-chrome-surface' as string]: webChromeSurface,
                  }
              : {}),
          display: 'flex',
          flex: 1,
          flexDirection: isSolidSlate
            ? 'column'
            : isDesktop || isWeb || isDark
              ? 'column'
              : (isDashboard || isHybrid)
                ? (isLandscape ? 'row' : 'row-reverse')
                : 'row',
          height: isDashboard ? 'calc(100% - 60px)' : '100%',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
          borderRadius: isDashboard ? '7px' : '0',
          border: isDashboard ? '1px solid rgba(0, 0, 0, 0.07)' : 'none',
          boxShadow: isDashboard ? '0 2px 8px rgba(15, 23, 42, 0.08)' : 'none',
          margin: isDashboard ? '0 10px 10px' : '0',
          padding: isHybrid
            ? isLandscape
              ? '17px'
              : '10px'
            : isSharp
              ? 'clamp(1rem, 4vw, 3rem) clamp(1rem, 6vw, 5rem) calc(clamp(1rem, 3.5vw, 2.5rem) + 40px)'
              : isDark
              ? 'clamp(1rem, 4vw, 3rem) clamp(1rem, 6vw, 5rem) clamp(5.75rem, 9vw, 7rem)'
              : '0',
        }}
      >
        {isDark && <div className="layout-dark__scrim" aria-hidden="true" />}
        {isHybrid && (
          <div
            className="layout-hybrid-console__padding-blur"
            aria-hidden="true"
            style={{ ['--hybrid-padding' as string]: isLandscape ? '17px' : '10px' }}
          />
        )}
        {isDashboard && !isLandscape && (
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

        <div
          className={
            isHybrid
              ? [
                  'layout-hybrid-console__surface',
                  !isAppsShortcutView ? 'layout-hybrid-console__surface--joined' : '',
                  isLandscape ? 'layout-hybrid-console__surface--landscape' : 'layout-hybrid-console__surface--portrait',
                  sidebarOnRight ? 'layout-hybrid-console__surface--menubar-right' : 'layout-hybrid-console__surface--menubar-left',
                ].filter(Boolean).join(' ')
              : undefined
          }
          style={
            isHybrid
              ? { flexDirection: isLandscape ? 'row' : 'row-reverse' }
              : { display: 'contents' }
          }
        >

        {/* Menu on side - left in dashboard landscape, right in dashboard portrait, left rail in hybrid */}
        {(isDashboard || isHybrid) && !isWindowMaximized && (
          <SidebarNav
            isDashboard={isDashboard}
            isHybrid={isHybrid}
            isDashboardMenuVisible={isDashboardMenuVisible}
            isLandscape={isLandscape}
            sidebarOnRight={sidebarOnRight}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            sidebarMenuItems={sidebarMenuItems}
            accountSubmenuItems={accountSubmenuItems}
            showAccountSubmenu={showAccountSubmenu}
            settingsMenuItem={settingsMenuItem}
            activeWindowId={activeWindowId}
            authToken={authToken}
            hoveredClosableMenuKey={hoveredClosableMenuKey}
            openedAccountsMenuArea={openedAccountsMenuArea}
            sidebarAccountHubRef={sidebarAccountHubRef}
            getMenuItemColor={getMenuItemColor}
            onWindowChange={handleWindowChange}
            onCloseAppWindow={handleCloseAppWindow}
            onHoverClosableMenuKey={setHoveredClosableMenuKey}
            onToggleAccountsMenuArea={setOpenedAccountsMenuArea}
          />
        )}

        {isSolidSlate && !isWindowMaximized && (
          <SolidSlateNav
            primaryColor={primaryColor}
            iconColor={solidSlateIconColor}
            labelColor={solidSlateLabelColor}
            isWhitePalette={isWhitePalette}
            sidebarMenuItems={sidebarMenuItems}
            accountSubmenuItems={accountSubmenuItems}
            showAccountSubmenu={showAccountSubmenu}
            settingsMenuItem={settingsMenuItem}
            activeWindowId={activeWindowId}
            authToken={authToken}
            openedAccountsMenuArea={openedAccountsMenuArea}
            sidebarAccountHubRef={sidebarAccountHubRef}
            getMenuItemColor={getMenuItemColor}
            onWindowChange={handleWindowChange}
            onToggleAccountsMenuArea={setOpenedAccountsMenuArea}
          />
        )}

        {isWeb && !isWindowMaximized && (
          <WebLayoutNav
            isLandscape={isLandscape}
            isWhitePalette={isWhitePalette}
            whitePaletteChromeColor={whitePaletteChromeColor}
            secondaryColor={secondaryColor}
            primaryColor={primaryColor}
            webPrimaryNavItems={webPrimaryNavItems}
            openApps={openApps}
            settingsMenuItem={settingsMenuItem}
            activeWindowId={activeWindowId}
            activeLabel={activeLabel}
            authToken={authToken}
            isWebPortraitMenuOpen={isWebPortraitMenuOpen}
            getMenuItemColor={getMenuItemColor}
            onWindowChange={handleWindowChange}
            onWebPortraitMenuOpenChange={setIsWebPortraitMenuOpen}
          />
        )}
        {/* Content View Area */}
        <main
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            padding: isDashboard || isHybrid || isWeb || isSolidSlate || isDark || isWindowMaximized || isShortcutSurface || isSharp || isDesktop ? '0' : '0.5rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isDashboard || isHybrid || isWeb || isSolidSlate || isDark || isWindowMaximized || isShortcutSurface || isSharp ? 'stretch' : 'center',
            justifyContent: isDesktop && !isWindowMaximized ? 'center' : 'flex-start',
            paddingBottom: isDesktop && !isWindowMaximized ? `${desktopTaskbarHeightPx}px` : undefined,
            boxSizing: 'border-box',
            boxShadow: 'none',
            visibility: shouldHideDashboardWindowArea ? 'hidden' : 'visible',
          }}
        >
          {isWeb && !isWindowMaximized && (
            <div style={{ width: '100%', alignSelf: 'flex-start', boxSizing: 'border-box', padding: '2.25rem 3rem 1.25rem', color: 'rgba(26, 26, 26, 0.82)', fontSize: 'clamp(0.9rem, 1.6875vw, 1.6875rem)', fontWeight: 500, letterSpacing: '-0.04em', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ display: 'grid', placeItems: 'center', fontSize: '1.125em', color: '#334155' }}>{activeWindowIcon}</span>
              <span>{activeLabel}</span>
            </div>
          )}
          <div
            id="window"
            className={[
              isWindowMaximized ? 'window-maximized' : '',
              isDark && isAppsShortcutView ? 'dark-window-app-list' : '',
            ].filter(Boolean).join(' ') || undefined}
            onDoubleClick={toggleDesktopFullscreen}
            style={{
              position: isWindowMaximized ? 'fixed' : 'relative',
              inset: isWindowMaximized ? 0 : undefined,
              width: isShortcutSurface
                ? '100%'
                : isWindowMaximized
                  ? '100vw'
                  : isSolidSlate
                    ? 'auto'
                    : isWeb
                      ? isLandscape
                        ? '95%'
                        : '97%'
                      : isDashboard || isHybrid || isSharp || isDark
                        ? '100%'
                        : `min(100%, ${DESKTOP_WINDOW_MAX_WIDTH_PX}px)`,
              height: isShortcutSurface
                ? '100%'
                : isWindowMaximized
                  ? '100vh'
                  : isSolidSlate
                    ? undefined
                    : isWeb
                      ? 'calc(100% - 7.75rem)'
                      : isSharp
                        ? '100%'
                        : isDark
                          ? 'calc(100% + 10px)'
                          : isDashboard || isHybrid
                            ? '100%'
                            : desktopWindowHeight,
              flex: isSolidSlate && !isWindowMaximized ? 1 : undefined,
              minHeight: isSolidSlate && !isWindowMaximized ? 0 : undefined,
              maxWidth: isShortcutSurface || isDashboard || isHybrid || isWeb || isSolidSlate || isSharp || isDark || isWindowMaximized ? 'none' : `${DESKTOP_WINDOW_MAX_WIDTH_PX}px`,
              alignSelf: isWeb || isDesktop ? 'center' : isShortcutSurface || isDashboard || isHybrid || isSolidSlate || isSharp || isDark || isWindowMaximized ? 'stretch' : 'stretch',
              background: isShortcutSurface
                ? 'transparent'
                : isDashboard
                  ? '#ffffff'
                  : isWeb
                    ? 'transparent'
                    : isSolidSlate
                      ? solidSlateBackdropColor
                      : isDark
                        ? undefined
                      : isDesktop
                        ? desktopChromeSurface
                      : isSharp
                        ? 'rgba(255, 255, 255, 0.19)'
                        : 'rgba(255, 255, 255, 0.18)',
              backdropFilter: isShortcutSurface ? 'none' : isWeb ? 'none' : isSolidSlate || isDark ? undefined : isDesktop ? desktopBackdropBlur : 'blur(24px)',
              borderRadius: isWindowMaximized
                ? '0'
                : isSolidSlate
                  ? '8px'
                  : isHybrid
                    ? undefined
                    : isWeb
                      ? '10px'
                      : isShortcutSurface || isDashboard || isSharp
                        ? '0'
                        : isDark
                          ? '18px'
                          : '5px',
              padding: '0',
              margin: isSolidSlate && !isWindowMaximized ? '10px' : isWeb && !isWindowMaximized ? '0 auto 1rem' : undefined,
              boxShadow: isShortcutSurface
                ? 'none'
                : isWindowMaximized
                  ? 'none'
                  : isHybrid
                    ? 'none'
                    : isDashboard
                    ? '0 2px 16px rgba(0,0,0,0.06)'
                    : isSharp
                      ? '0 16px 40px rgba(15, 23, 42, 0.15)'
                      : isWeb
                        ? activeWindowId === 'apps'
                          ? 'none'
                          : '0 8px 32px rgba(15, 23, 42, 0.1)'
                      : isDark
                        ? undefined
                      : '0 16px 40px rgba(0, 0, 0, 0.18)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              zIndex: isWindowMaximized ? 1000 : undefined,
              transition: 'all 0.3s ease',
              color: isDark ? 'rgba(255, 255, 255, 0.92)' : '#0f172a',
              overflow: 'hidden', // let inner content div scroll
            }}
          >
            {!isShortcutSurface && !hasPartialTitleBar && !(isSolidSlate && !activeAppKey) && renderWindowChrome()}

            {/* Window content — scrollable */}
            <div
              id="client"
              className={isWeb ? 'web-native-content' : isDark ? 'dark-window-content' : undefined}
              style={{
                padding: '0',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0,
                display: activeAppKey ? 'flex' : 'block',
                flexDirection: 'column',
              }}
            >
              <NativeWindowContent isActive={activeWindowId === 'apps'} fillHeight={isAppsShortcutView || isWeb}>
                {isWeb ? (
                  <WebAppCards
                    apps={launcherApps.map((app) => ({ key: app.key, name: app.name, description: app.description, icon: app.iconNode, onOpen: app.open }))}
                  />
                ) : isAppsShortcutView ? (
                  isSolidSlate ? (
                    <div
                      className="solid-slate-app-grid"
                      style={{
                        ['--solid-slate-icon' as string]: solidSlateIconColor,
                        ['--solid-slate-label' as string]: solidSlateLabelColor,
                      }}
                    >
                      <div className="solid-slate-app-grid__inner">
                        {launcherApps.map((app) => (
                          <Button
                            key={app.key}
                            onClick={app.open}
                            type="text"
                            className="app-brick-btn app-brick-btn-solid-slate"
                            style={{
                              border: 'none',
                              boxShadow: 'none',
                              outline: 'none',
                            }}
                          >
                            <div className="app-brick-btn-solid-slate__icon">
                              {renderAppIcon(
                                apps.find((entry) => entry.key === app.key)?.icon ?? '',
                                solidSlateIconColor,
                              )}
                            </div>
                            <div className="app-brick-label app-brick-btn-solid-slate__label" title={app.name}>
                              {app.name}
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: isHybrid
                          ? 'flex'
                          : isLandscape && isDesktop
                            ? 'flex'
                            : 'grid',
                        flexDirection: isHybrid || (isLandscape && isDesktop) ? 'column' : undefined,
                        flexWrap: isHybrid || (isLandscape && isDesktop) ? 'wrap' : undefined,
                        alignContent: isHybrid || (isLandscape && isDesktop) ? 'flex-start' : undefined,
                        alignItems: isHybrid ? 'flex-start' : undefined,
                        gridTemplateColumns: isHybrid
                          ? undefined
                          : isLandscape
                            ? isDesktop
                              ? undefined
                              : 'repeat(auto-fill, minmax(92px, 1fr))'
                            : 'repeat(3, minmax(0, 1fr))',
                        gap: isHybrid ? '0.75rem' : '1rem 0.8rem',
                        maxWidth: isHybrid ? '100%' : isLandscape && !isDesktop ? '780px' : '100%',
                        height: isHybrid || (isLandscape && isDesktop) ? '100%' : undefined,
                        overflowX: isHybrid || (isLandscape && isDesktop) ? 'auto' : undefined,
                        overflowY: isHybrid ? 'hidden' : isLandscape && isDesktop ? 'hidden' : undefined,
                        padding: isHybrid ? '1rem' : undefined,
                        boxSizing: 'border-box',
                      }}
                    >
                      {launcherApps.map((app) => (
                        <Button
                          key={app.key}
                          onClick={app.open}
                          type="text"
                          className={isHybrid ? 'app-brick-btn app-brick-btn-hybrid' : isDark ? 'app-brick-btn app-brick-btn-dark' : 'app-brick-btn app-brick-btn-desktop'}
                          style={
                            isHybrid
                              ? hybridAppbrick
                              : isDark
                                ? {
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.25rem',
                                  borderRadius: '10px',
                                }
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
                            className={
                              isDark
                                ? 'app-brick-btn-dark__icon'
                                : isDesktop
                                  ? 'app-brick-btn-desktop__icon'
                                  : undefined
                            }
                            style={
                              isHybrid
                                ? {
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '0',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#334155',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: 'calc(1rem + 2px)',
                                  backdropFilter: 'none',
                                }
                                : isDark
                                  ? undefined
                                  : isDesktop
                                    ? {
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '14px',
                                    background: desktopChromeSurface,
                                    border: '1px solid rgba(255,255,255,0.25)',
                                    color: desktopAppIconColor,
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '1.45rem',
                                    backdropFilter: desktopBackdropBlur,
                                  }
                                  : {
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '14px',
                                  background: 'rgba(255,255,255,0.35)',
                                  border: '1px solid rgba(255,255,255,0.25)',
                                  color: '#334155',
                                  display: 'grid',
                                  placeItems: 'center',
                                  fontSize: '1.45rem',
                                  backdropFilter: 'blur(3px)',
                                }
                            }
                          >
                            <span style={{ filter: isAppsShortcutView && !isDark && !isDesktop ? 'saturate(0.65)' : 'none' }}>
                              {app.iconNode}
                            </span>
                          </div>
                          <div
                            className="app-brick-label"
                            style={{
                              fontSize: isHybrid ? '12px' : isDark ? '0.72rem' : '0.78rem',
                              fontWeight: 400,
                              color: isHybrid ? '#0f172a' : '#ffffff',
                              textShadow: isHybrid ? 'none' : '0 1px 2px rgba(0,0,0,0.55)',
                              textAlign: 'center',
                              lineHeight: 1.2,
                              padding: isHybrid ? '0 2px' : '0',
                            }}
                            title={app.name}
                          >
                            {app.name}
                          </div>
                        </Button>
                      ))}
                    </div>
                  )
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
                              <div className="app-card-label" style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }} title={app.name}>{app.name}</div>
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
                <MonitorView isDashboard={isDashboard} primaryColor={primaryColor} />
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'files'} fillHeight noPadding>
                {activeWindowId === 'files' ? (
                  <FileExplorer
                    isLoggedIn={Boolean(authUser)}
                    onLoginRequired={() => setActiveWindowId('accounts')}
                  />
                ) : null}
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'terminal'} fillHeight noPadding>
                <TerminalView activeTheme={activeTheme} />
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'accounts'}>
                <AccountsView
                  authUser={authUser}
                  accountError={accountError}
                  accountMessage={accountMessage}
                  loginUsername={loginUsername}
                  loginPassword={loginPassword}
                  changeNameValue={changeNameValue}
                  currentPassword={currentPassword}
                  newPassword={newPassword}
                  onLoginUsernameChange={setLoginUsername}
                  onLoginPasswordChange={setLoginPassword}
                  onChangeNameValueChange={setChangeNameValue}
                  onCurrentPasswordChange={setCurrentPassword}
                  onNewPasswordChange={setNewPassword}
                  onLoginRequest={handleLoginRequest}
                  onChangeName={handleChangeName}
                  onResetPassword={handleResetPassword}
                  onLogoutRequest={handleLogoutRequest}
                  onOpenMembers={() => setActiveWindowId('members')}
                />
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'members'}>
                <MembersView members={members} membersError={membersError} />
              </NativeWindowContent>

              <NativeWindowContent isActive={activeWindowId === 'settings'}>
                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>System Configuration</h2>
                <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
                  Manage domain registration, network layout, and appearance settings.
                </p>

                <SystemSettingsPanel
                  isLandscape={isLandscape}
                  layoutMode={layoutMode}
                  windowLayout={windowLayout}
                  activeTheme={activeTheme}
                  activeWallp={activeWallp}
                  primaryColor={primaryColor}
                  isAdmin={authUser?.role === 'Admin'}
                  authToken={authToken}
                  onLayoutModeChange={handleLayoutModeChange}
                  onWindowLayoutChange={handleWindowLayoutChange}
                  onColorPaletteChange={handleColorPaletteChange}
                  onWallpaperChange={handleWallpaperChange}
                  onDomainSetupComplete={() => handleLayoutModeChange('desktop')}
                />
              </NativeWindowContent>
              {openApps.map((app) => (
                <div
                  key={app.key}
                  style={{
                    display: activeWindowId === `app:${app.key}` ? 'flex' : 'none',
                    flexDirection: 'column',
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <AppWindow
                    key={`${app.key}-${appSessionVersions[app.key] ?? 0}`}
                    appKey={app.key}
                    appRoute={app.route ?? app.key}
                    appName={app.name}
                    appIcon={renderAppIcon(app.icon)}
                    controlsOpen={Boolean(openAppControls[app.key])}
                    controlsSide={controlsSide}
                    titleBarStyle={titleBarStyle}
                    controlsWidth={controlsPanelWidth}
                    titleBarHeight={titleBarHeight}
                    transparentControls={isDesktop || isSolidSlate || isDark}
                    showControlsBorder={isDashboard}
                    primaryColor={primaryColor}
                    collapsedStripBackground={collapsedControlStripBackground}
                    controlsBackground={isWeb ? webChromeSurface : controlPaneSurface}
                    themedCollapsedControlStrip={useThemedCollapsedControlStrip}
                    partialChrome={
                      hasPartialTitleBar && activeWindowId === `app:${app.key}`
                        ? renderWindowChrome(true)
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>{/* end window content */}
          </div>
        </main>

        </div>

        {/* Bottom task bar for Desktop and Sharp layouts */}
        {(isDesktop || isSharp || isDark) && (
          <DesktopTaskbar
            items={visibleMenuItems}
            accountSubmenuItems={accountSubmenuItems}
            showAccountSubmenu={showAccountSubmenu}
            activeWindowId={activeWindowId}
            openedAccountsMenuArea={openedAccountsMenuArea}
            setOpenedAccountsMenuArea={setOpenedAccountsMenuArea}
            isDesktop={isDesktop}
            isSharp={isSharp}
            isDark={isDark}
            isLandscape={isLandscape}
            isWindowMaximized={isWindowMaximized}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            desktopChromeSurface={desktopChromeSurface}
            desktopBackdropBlur={desktopBackdropBlur}
            getMenuItemColor={getMenuItemColor}
            withMenuIconColor={withMenuIconColor}
            onWindowChange={(key) => handleWindowChange(key as WindowId)}
          />
        )}
      </div>
      </MainContextMenu>
    </div>
  )
}

export default Dashboard
