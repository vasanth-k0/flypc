import React from 'react'
import { message, Modal, type MenuProps } from 'antd'
import {
  LuGhost,
  LuLogIn,
  LuLogOut,
  LuMaximize2,
  LuMinimize2,
  LuRefreshCw,
  LuShuffle,
  LuThumbsUp,
} from 'react-icons/lu'
import { ContextMenuShell, type ContextMenuHoverState, type ContextMenuShellHandle } from './ContextMenuShell'
import { CONTEXT_MENU_ICON_SIZE, contextMenuItemLabel } from './contextMenuItems'
import {
  ColorContextPanel,
  LayoutContextPanel,
  LoginContextPanel,
  WallpaperContextPanel,
} from './ContextMenuOptionPanels'
import { isPageFullscreen, togglePageFullscreen } from '../../utils/pageFullscreen'
import { reloadPage } from '../../utils/reloadPage'
import type { LayoutMode } from '../../store/settingsSlice'

const HOVERABLE_MENU_KEYS = new Set([
  'random-wallpaper',
  'random-color-palette',
  'random-layout',
  'login',
])

type MainContextMenuProps = {
  isLandscape: boolean
  isLoggedIn: boolean
  layoutMode: LayoutMode
  activeTheme: string
  activeWallp: number
  primaryColor: string
  loginUsername: string
  loginPassword: string
  accountError?: string
  onLoginUsernameChange: (value: string) => void
  onLoginPasswordChange: (value: string) => void
  onLoginSubmit: () => void
  onLogin?: () => void
  onLogout?: () => void
  onWallpaperChange: (id: number) => void
  onLayoutModeChange: (mode: LayoutMode) => void
  onColorPaletteChange: (themeName: string) => void
  onRandomWallpaper?: () => void
  onRandomLayout?: () => void
  onRandomColorPalette?: () => void
  onEnterPageFullscreen?: () => void
  onReload?: () => void | Promise<void>
  children: React.ReactNode
}

export const MainContextMenu = React.forwardRef<ContextMenuShellHandle, MainContextMenuProps>(
  (
    {
      isLandscape,
      isLoggedIn,
      layoutMode,
      activeTheme,
      activeWallp,
      primaryColor,
      loginUsername,
      loginPassword,
      accountError,
      onLoginUsernameChange,
      onLoginPasswordChange,
      onLoginSubmit,
      onLogin,
      onLogout,
      onWallpaperChange,
      onLayoutModeChange,
      onColorPaletteChange,
      onRandomWallpaper,
      onRandomLayout,
      onRandomColorPalette,
      onEnterPageFullscreen,
      onReload,
      children,
    },
    ref,
  ) => {
  const menuRef = React.useRef<ContextMenuShellHandle>(null)
  const [fullscreen, setFullscreen] = React.useState(() => isPageFullscreen())
  const [hoverState, setHoverState] = React.useState<ContextMenuHoverState | null>(null)

  React.useEffect(() => {
    if (!isLandscape) {
      setHoverState(null)
    }
  }, [isLandscape])

  React.useImperativeHandle(ref, () => ({
    openAt: (x, y) => {
      menuRef.current?.openAt(x, y)
    },
  }))

  React.useEffect(() => {
    const syncFullscreen = (): void => setFullscreen(isPageFullscreen())
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const attachHoverHandlers = (item: NonNullable<MenuProps['items']>[number], key: string) => {
    if (!isLandscape || !item || item.type === 'divider' || item.type === 'group' || !HOVERABLE_MENU_KEYS.has(key)) {
      return item
    }

    if (key === 'login' && isLoggedIn) {
      return item
    }

    return {
      ...item,
      onMouseEnter: () => {
        setHoverState({ key })
      },
    }
  }

  const rawItems: MenuProps['items'] = [
    {
      key: 'do-nothing',
      label: contextMenuItemLabel(<LuGhost size={CONTEXT_MENU_ICON_SIZE} />, 'Do nothing'),
      onClick: () => {
        message.success({
          content: 'OK',
          icon: <LuThumbsUp size={16} />,
        })
      },
    },
    {
      key: 'fullscreen',
      label: contextMenuItemLabel(
        fullscreen ? <LuMinimize2 size={CONTEXT_MENU_ICON_SIZE} /> : <LuMaximize2 size={CONTEXT_MENU_ICON_SIZE} />,
        fullscreen ? 'Exit fullscreen' : 'Fullscreen',
      ),
      onClick: () => {
        if (!fullscreen) {
          onEnterPageFullscreen?.()
        }
        void togglePageFullscreen().then((next) => setFullscreen(next))
      },
    },
    {
      key: 'reload',
      label: contextMenuItemLabel(<LuRefreshCw size={CONTEXT_MENU_ICON_SIZE} />, 'Reload'),
      onClick: () => {
        Modal.confirm({
          title: 'Reload page?',
          content: 'This will refresh the console and reload all open apps.',
          okText: 'Reload',
          cancelText: 'Cancel',
          onOk: async () => {
            if (onReload) {
              await onReload()
              return
            }
            await reloadPage()
          },
        })
      },
    },
    attachHoverHandlers({
      key: 'random-wallpaper',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Wallpaper'),
      onClick: () => {
        onRandomWallpaper?.()
      },
    }, 'random-wallpaper'),
    attachHoverHandlers({
      key: 'random-color-palette',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Color'),
      onClick: () => {
        onRandomColorPalette?.()
      },
    }, 'random-color-palette'),
    attachHoverHandlers({
      key: 'random-layout',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Layout'),
      onClick: () => {
        onRandomLayout?.()
      },
    }, 'random-layout'),
    { type: 'divider' },
    isLoggedIn
      ? {
          key: 'logout',
          label: contextMenuItemLabel(<LuLogOut size={CONTEXT_MENU_ICON_SIZE} />, 'Log out'),
          onClick: () => {
            onLogout?.()
          },
        }
      : attachHoverHandlers({
          key: 'login',
          label: contextMenuItemLabel(<LuLogIn size={CONTEXT_MENU_ICON_SIZE} />, 'Log in'),
          onClick: () => onLogin?.(),
        }, 'login'),
  ]

  const hoverPaneContent = React.useMemo(() => {
    if (!isLandscape || !hoverState) {
      return null
    }

    switch (hoverState.key) {
      case 'random-wallpaper':
        return (
          <WallpaperContextPanel
            activeWallp={activeWallp}
            primaryColor={primaryColor}
            onWallpaperChange={onWallpaperChange}
          />
        )
      case 'random-color-palette':
        return (
          <ColorContextPanel
            activeTheme={activeTheme}
            onColorPaletteChange={onColorPaletteChange}
          />
        )
      case 'random-layout':
        return (
          <LayoutContextPanel
            layoutMode={layoutMode}
            primaryColor={primaryColor}
            onLayoutModeChange={onLayoutModeChange}
          />
        )
      case 'login':
        return (
          <LoginContextPanel
            loginUsername={loginUsername}
            loginPassword={loginPassword}
            accountError={accountError}
            onLoginUsernameChange={onLoginUsernameChange}
            onLoginPasswordChange={onLoginPasswordChange}
            onLoginSubmit={onLoginSubmit}
          />
        )
      default:
        return null
    }
  }, [
    accountError,
    activeTheme,
    activeWallp,
    hoverState,
    isLandscape,
    layoutMode,
    loginPassword,
    loginUsername,
    onColorPaletteChange,
    onLayoutModeChange,
    onLoginPasswordChange,
    onLoginSubmit,
    onLoginUsernameChange,
    onWallpaperChange,
    primaryColor,
  ])

  return (
    <ContextMenuShell
      ref={menuRef}
      items={rawItems}
      eventPhase="bubble"
      hoverState={isLandscape ? hoverState : null}
      onHoverStateChange={isLandscape ? setHoverState : undefined}
      hoverPaneContent={isLandscape ? hoverPaneContent : null}
      hoverPanePrimaryColor={primaryColor}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', width: '100%' }}
      onOpenChange={(open) => {
        if (!open) {
          setHoverState(null)
        }
        if (open) {
          setFullscreen(isPageFullscreen())
        }
      }}
    >
      {children}
    </ContextMenuShell>
  )
  },
)

MainContextMenu.displayName = 'MainContextMenu'
