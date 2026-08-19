import React from 'react'
import { message, type MenuProps } from 'antd'
import {
  LuGhost,
  LuLogIn,
  LuLogOut,
  LuMaximize2,
  LuMinimize2,
  LuRefreshCw,
  LuSearchCode,
  LuShuffle,
  LuThumbsUp,
} from 'react-icons/lu'
import { ContextMenuShell, type ContextMenuShellHandle } from './ContextMenuShell'
import { CONTEXT_MENU_ICON_SIZE, contextMenuItemLabel } from './contextMenuItems'
import { openDevTools } from '../../utils/devTools'
import { isPageFullscreen, togglePageFullscreen } from '../../utils/pageFullscreen'

type MainContextMenuProps = {
  isLoggedIn: boolean
  isAdmin?: boolean
  onLogin?: () => void
  onLogout?: () => void
  onRandomWallpaper?: () => void
  onRandomLayout?: () => void
  onRandomColorPalette?: () => void
  onEnterPageFullscreen?: () => void
  children: React.ReactNode
}

export const MainContextMenu = React.forwardRef<ContextMenuShellHandle, MainContextMenuProps>(
  (
    {
      isLoggedIn,
      isAdmin = false,
      onLogin,
      onLogout,
      onRandomWallpaper,
      onRandomLayout,
      onRandomColorPalette,
      onEnterPageFullscreen,
      children,
    },
    ref,
  ) => {
  const menuRef = React.useRef<ContextMenuShellHandle>(null)
  const inspectPointRef = React.useRef({ x: 0, y: 0 })
  const [fullscreen, setFullscreen] = React.useState(() => isPageFullscreen())

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

  const items: MenuProps['items'] = [
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
        window.location.reload()
      },
    },
    ...(isAdmin
      ? [
          {
            key: 'inspect',
            label: contextMenuItemLabel(<LuSearchCode size={CONTEXT_MENU_ICON_SIZE} />, 'Inspect'),
            onClick: () => {
              const { x, y } = inspectPointRef.current
              void openDevTools(x, y)
            },
          },
        ]
      : []),
    {
      key: 'random-wallpaper',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Wallpaper'),
      onClick: () => {
        onRandomWallpaper?.()
      },
    },
    {
      key: 'random-color-palette',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Color'),
      onClick: () => {
        onRandomColorPalette?.()
      },
    },
    {
      key: 'random-layout',
      label: contextMenuItemLabel(<LuShuffle size={CONTEXT_MENU_ICON_SIZE} />, 'Layout'),
      onClick: () => {
        onRandomLayout?.()
      },
    },
    { type: 'divider' },
    isLoggedIn
      ? {
          key: 'logout',
          label: contextMenuItemLabel(<LuLogOut size={CONTEXT_MENU_ICON_SIZE} />, 'Log out'),
          onClick: () => {
            onLogout?.()
          },
        }
      : {
          key: 'login',
          label: contextMenuItemLabel(<LuLogIn size={CONTEXT_MENU_ICON_SIZE} />, 'Log in'),
          onClick: () => onLogin?.(),
        },
  ]

  return (
    <ContextMenuShell
      ref={menuRef}
      items={items}
      eventPhase="bubble"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', width: '100%' }}
      onOpenAt={(x, y) => {
        inspectPointRef.current = { x, y }
      }}
      onOpenChange={(open) => {
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
