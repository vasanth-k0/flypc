import type { LayoutMode } from '../store/settingsSlice'
import type { AppEntry, AuthUser, WindowId } from '../types/dashboard'
import { buildAccountSubmenuItems, buildVisibleMenuItems, renderAppIcon, type MenuItem } from '../utils/menuIcons'
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
  controlsSide: 'left' | 'right'
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
  controlsSide,
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
  const accountHubMenuItem: MenuItem = {
    key: 'account-hub',
    label: 'Accounts',
    icon: <UserOutlined />,
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
  const whitePaletteChromeColor = '#334155'
  const useLightTitleBar = isDashboard && !hasRightControls
  const titleButtonIconColor = isWhitePalette || useLightTitleBar ? whitePaletteChromeColor : '#ffffff'
  const windowTitleColor = isWhitePalette
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
      ? <UserOutlined />
      : menuItems.find((item) => item.key === activeWindowId)?.icon ?? <AppstoreOutlined />

  const visibleMenuItems = buildVisibleMenuItems(menuItems, openApps, accountHubMenuItem)
  const sidebarMenuItems = visibleMenuItems.filter((item) => item.key !== 'settings')
  const settingsMenuItem = menuItems.find((item) => item.key === 'settings')!
  const webPrimaryNavItems = [
    ...menuItems.filter((item) => item.key !== 'settings'),
    { key: 'accounts', label: 'Accounts', icon: <UserOutlined /> },
  ]

  const getMenuItemColor = (isActive: boolean): string => {
    if (isWhitePalette) {
      return whitePaletteChromeColor
    }
    if (isActive) {
      return '#ffffff'
    }
    return 'rgba(255, 255, 255, 0.68)'
  }

  return {
    menuItems,
    accountSubmenuItems,
    accountHubMenuItem,
    isDashboard,
    isDesktop,
    isHybrid,
    isSharp,
    isWeb,
    isDesktopLike,
    sidebarOnRight,
    isAppsLauncherWindow,
    isAppsShortcutView,
    isShortcutSurface,
    desktopWindowHeight,
    isWindowMaximized,
    activeAppKey,
    hasRightControlsOpen,
    hasRightControls,
    controlsPanelWidth,
    collapsedControlsPanelWidth,
    rightControlsHeaderWidth,
    titleBarHeight,
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
  }
}
