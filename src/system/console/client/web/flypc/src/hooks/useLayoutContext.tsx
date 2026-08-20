import type { LayoutMode, WindowLayout } from '../store/settingsSlice'
import type { AppEntry, AuthUser, WindowId } from '../types/dashboard'
import { resolveEffectiveWindowChrome } from '../utils/windowLayout'
import { buildAccountSubmenuItems, buildVisibleMenuItems, renderAppIcon, type MenuItem } from '../utils/menuIcons'
import { ColorPalette } from '../globals/ColorPalette'
import { Badge } from 'antd'
import {
  AppstoreOutlined,
  MonitorOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'

type LayoutContextInput = {
  layoutMode: LayoutMode
  activeTheme: string
  primary?: string
  secondary?: string
  windowLayout: WindowLayout
  activeWindowId: WindowId
  openApps: AppEntry[]
  openAppControls: Record<string, boolean>
  isMaximized: boolean
  isLandscape: boolean
  authUser: AuthUser | null
}

export const useLayoutContext = ({
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
}: LayoutContextInput) => {
  const menuItems: MenuItem[] = [
    { key: 'apps', label: 'Apps', icon: <AppstoreOutlined /> },
    { key: 'monitor', label: 'Monitor', icon: <MonitorOutlined /> },
    { key: 'files', label: 'File Manager', icon: <FolderOpenOutlined /> },
    { key: 'terminal', label: 'Terminal', icon: <ThunderboltOutlined /> },
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
  ]

  const accountSubmenuItems = buildAccountSubmenuItems(authUser?.role === 'Admin')
  const isLoggedIn = Boolean(authUser)
  const showAccountSubmenu = isLoggedIn && authUser?.role === 'Admin'
  const userStatusIcon = (
    <Badge
      dot
      status={isLoggedIn ? 'success' : 'default'}
      title={isLoggedIn ? 'Signed in' : 'Guest'}
      styles={{
        root: { color: 'inherit', lineHeight: 0 },
        indicator: {
          width: 4,
          height: 4,
          minWidth: 4,
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.85)',
        },
      }}
    >
      <UserOutlined style={{ fontSize: 16, color: 'inherit' }} />
    </Badge>
  )
  const accountHubMenuItem: MenuItem = {
    key: 'account-hub',
    label: 'Accounts',
    icon: userStatusIcon,
  }

  const isDashboard = layoutMode === 'dashboard'
  const isDesktop = layoutMode === 'desktop'
  const isHybrid = layoutMode === 'hybrid-console'
  const isSharp = layoutMode === 'sharp'
  const isWeb = layoutMode === 'web'
  const isSolidSlate = layoutMode === 'solid-slate'
  const isDark = layoutMode === 'dark'
  const isDesktopLike = isDesktop || isHybrid || isSharp || isWeb || isSolidSlate || isDark
  const sidebarOnRight = !isLandscape && (isDashboard || isHybrid)
  const isAppsLauncherWindow = activeWindowId === 'apps'
  const isAppsShortcutView = !isDashboard && !isWeb && isAppsLauncherWindow && isDesktopLike
  const isShortcutSurface = isAppsShortcutView
  const desktopTaskbarHeightPx = 50
  const desktopVerticalInsetPx = 25
  const desktopWindowHeight = isDesktop
    ? `calc(100% - ${desktopTaskbarHeightPx}px - ${desktopVerticalInsetPx * 2}px)`
    : '100%'
  const isWindowMaximized = isMaximized && (isDashboard || isDesktop || isHybrid || isSharp || isWeb || isSolidSlate || isDark)
  const activeAppKey = activeWindowId.startsWith('app:') ? activeWindowId.slice(4) : null
  const isUserAppWindow = Boolean(activeAppKey)
  const effectiveWindowChrome = resolveEffectiveWindowChrome(windowLayout, isLandscape, isUserAppWindow)
  const hasPartialTitleBar = isUserAppWindow && effectiveWindowChrome.titleBarStyle === 'partial'
  const partialTitleSide = effectiveWindowChrome.controlsSide
  const hasPartialControlsOpen = Boolean(activeAppKey && openAppControls[activeAppKey] && hasPartialTitleBar)
  const controlsPanelWidth = !isLandscape ? '100%' : isDesktop ? '30%' : '25%'
  const collapsedControlsPanelWidth = '2.5rem'
  const partialControlsHeaderWidth = hasPartialTitleBar
    ? hasPartialControlsOpen
      ? controlsPanelWidth
      : collapsedControlsPanelWidth
    : '100%'
  const titleBarHeight = '2.35rem'
  const primaryColor = primary || '#597ef7'
  const secondaryColor = secondary || '#85a5ff'
  const isWhitePalette = ColorPalette.isLightPrimaryTheme(activeTheme)
  const whitePaletteChromeColor = '#334155'
  const solidSlateLightChromeColor = '#1a1a1a'

  const darkenHex = (color: string, amount: number): string => {
    const value = color.replace('#', '')
    if (!/^[\da-f]{6}$/i.test(value)) return '#1e293b'

    const toDarkChannel = (channel: string) =>
      Math.round(parseInt(channel, 16) * (1 - amount)).toString(16).padStart(2, '0')

    return `#${toDarkChannel(value.slice(0, 2))}${toDarkChannel(value.slice(2, 4))}${toDarkChannel(value.slice(4, 6))}`
  }

  const mixPrimaryWithWhite = (color: string, amount = 0.04): string => {
    const value = color.replace('#', '')
    if (!/^[\da-f]{6}$/i.test(value)) return '#fbfcfe'

    const mixChannel = (channel: string) =>
      Math.round(parseInt(channel, 16) * amount + 255 * (1 - amount))

    return `rgb(${mixChannel(value.slice(0, 2))}, ${mixChannel(value.slice(2, 4))}, ${mixChannel(value.slice(4, 6))})`
  }

  const solidSlateIconColor = isWhitePalette ? solidSlateLightChromeColor : '#ffffff'
  const solidSlateAccentColor = solidSlateIconColor
  const solidSlateBackdropStart = isWhitePalette ? primaryColor : darkenHex(primaryColor, 0.62)
  const solidSlateBackdropEnd = isWhitePalette ? secondaryColor : darkenHex(primaryColor, 0.78)
  const solidSlateBackdropColor = `linear-gradient(180deg, ${solidSlateBackdropStart} 0%, ${solidSlateBackdropEnd} 100%)`
  const solidSlateTopBarColor = isWhitePalette ? primaryColor : darkenHex(primaryColor, 0.52)
  const solidSlateLabelColor = isWhitePalette ? 'rgba(26, 26, 26, 0.92)' : '#ffffff'
  const darkIconColor = isWhitePalette ? solidSlateLightChromeColor : '#ffffff'
  const useLightTitleBar = isDashboard && !hasPartialTitleBar
  const titleButtonIconColor = isDark
    ? isWhitePalette
      ? solidSlateLightChromeColor
      : 'rgba(255, 255, 255, 0.88)'
    : isWeb
      ? isWhitePalette
        ? whitePaletteChromeColor
        : '#334155'
    : isSolidSlate
      ? isWhitePalette
        ? solidSlateLightChromeColor
        : 'rgba(255, 255, 255, 0.88)'
      : isWhitePalette || useLightTitleBar
        ? whitePaletteChromeColor
        : '#ffffff'
  const webChromeSurface = 'transparent'
  const useThemedCollapsedControlStrip = isDashboard || isDark || isHybrid || isSolidSlate
  const partialTitleBarBackground = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : isWeb
      ? webChromeSurface
      : isSolidSlate
        ? solidSlateTopBarColor
        : primaryColor
  const usesOpaqueControlPane = isDashboard || isHybrid || isSharp || isDesktop || isSolidSlate
  const controlPaneSurface = usesOpaqueControlPane ? mixPrimaryWithWhite(primaryColor) : undefined
  const useOpaqueCollapsedControlStrip = isSharp || isDesktop
  const collapsedControlStripBackground = useThemedCollapsedControlStrip
    ? isSolidSlate
      ? mixPrimaryWithWhite(primaryColor)
      : partialTitleBarBackground
    : useOpaqueCollapsedControlStrip
      ? controlPaneSurface ?? mixPrimaryWithWhite(primaryColor)
      : 'transparent'

  const windowTitleColor = isDark
    ? isWhitePalette
      ? 'rgba(26, 26, 26, 0.92)'
      : 'rgba(255, 255, 255, 0.92)'
    : isWeb
      ? isWhitePalette
        ? whitePaletteChromeColor
        : '#1a1a1a'
    : isSolidSlate
      ? isWhitePalette
        ? 'rgba(26, 26, 26, 0.92)'
        : 'rgba(255, 255, 255, 0.92)'
      : isWhitePalette
        ? whitePaletteChromeColor
        : useLightTitleBar
          ? 'black'
          : '#ffffff'

  const activeLabel =
    activeWindowId.startsWith('app:')
      ? openApps.find((app) => `app:${app.key}` === activeWindowId)?.name ?? 'App'
      : activeWindowId === 'accounts'
        ? 'Accounts'
        : activeWindowId === 'members'
          ? 'Members'
          : menuItems.find((m) => m.key === activeWindowId)?.label ?? 'Console'

  const activeWindowIcon = activeWindowId.startsWith('app:')
    ? renderAppIcon(openApps.find((app) => `app:${app.key}` === activeWindowId)?.icon ?? '')
    : activeWindowId === 'accounts' || activeWindowId === 'members'
      ? userStatusIcon
      : menuItems.find((item) => item.key === activeWindowId)?.icon ?? <AppstoreOutlined />

  const visibleMenuItems = buildVisibleMenuItems(menuItems, openApps, accountHubMenuItem)
  const sidebarMenuItems = visibleMenuItems.filter((item) => item.key !== 'settings')
  const settingsMenuItem = menuItems.find((item) => item.key === 'settings')!
  const webPrimaryNavItems = [
    ...menuItems.filter((item) => item.key !== 'settings'),
    { key: 'accounts', label: 'Accounts', icon: userStatusIcon },
    ...(showAccountSubmenu
      ? [{ key: 'members' as WindowId, label: 'Members', icon: userStatusIcon }]
      : []),
  ]

  const getMenuItemColor = (isActive: boolean): string => {
    if (isWeb) {
      if (isWhitePalette) {
        return isActive ? primaryColor : whitePaletteChromeColor
      }
      return isActive ? primaryColor : 'rgba(26, 26, 26, 0.72)'
    }
    if (isDark) {
      if (isWhitePalette) {
        return isActive ? solidSlateLightChromeColor : 'rgba(26, 26, 26, 0.72)'
      }
      return isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.88)'
    }
    if (isSolidSlate) {
      if (isWhitePalette) {
        return isActive ? solidSlateLightChromeColor : 'rgba(26, 26, 26, 0.62)'
      }
      return '#ffffff'
    }
    if (isWhitePalette) {
      return whitePaletteChromeColor
    }
    if (isActive) {
      return '#ffffff'
    }
    return 'rgba(255, 255, 255, 0.68)'
  }

  const solidSlateGradientEnd = darkenHex(primaryColor, 0.28)

  return {
    solidSlateIconColor,
    solidSlateTopBarColor,
    solidSlateBackdropColor,
    solidSlateLabelColor,
    darkIconColor,
    menuItems,
    accountSubmenuItems,
    showAccountSubmenu,
    accountHubMenuItem,
    isDashboard,
    isDesktop,
    isHybrid,
    isSharp,
    isWeb,
    isSolidSlate,
    isDark,
    isDesktopLike,
    sidebarOnRight,
    isAppsLauncherWindow,
    isAppsShortcutView,
    isShortcutSurface,
    desktopWindowHeight,
    desktopTaskbarHeightPx,
    isWindowMaximized,
    activeAppKey,
    controlsSide: effectiveWindowChrome.controlsSide,
    titleBarStyle: effectiveWindowChrome.titleBarStyle,
    hasPartialTitleBar,
    partialTitleSide,
    hasPartialControlsOpen,
    controlsPanelWidth,
    collapsedControlsPanelWidth,
    partialControlsHeaderWidth,
    titleBarHeight,
    partialTitleBarBackground,
    collapsedControlStripBackground,
    useThemedCollapsedControlStrip,
    webChromeSurface,
    controlPaneSurface,
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
    solidSlateAccentColor,
    solidSlateGradientEnd,
  }
}
