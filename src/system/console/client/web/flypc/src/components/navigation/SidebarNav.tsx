import React from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { FloatingSubmenu } from '../FloatingSubmenu'
import { NotificationPanel } from '../NotificationPanel'
import { withMenuIconColor, type MenuItem } from '../../utils/menuIcons'
import type { WindowId } from '../../types/dashboard'

export type AccountSubmenuItem = {
  key: WindowId
  label: string
  icon: React.ReactNode
}

export type SidebarNavProps = {
  isDashboard: boolean
  isHybrid: boolean
  isDashboardMenuVisible: boolean
  isLandscape: boolean
  sidebarOnRight: boolean
  primaryColor: string
  secondaryColor: string
  sidebarMenuItems: MenuItem[]
  accountSubmenuItems: AccountSubmenuItem[]
  settingsMenuItem: MenuItem
  activeWindowId: WindowId
  authToken: string
  hoveredClosableMenuKey: string | null
  openedAccountsMenuArea: 'sidebar' | 'footer' | null
  sidebarAccountHubRef: React.RefObject<HTMLDivElement | null>
  getMenuItemColor: (isActive: boolean) => string
  onWindowChange: (windowId: WindowId) => void
  onCloseAppWindow: (appKey: string) => void
  onHoverClosableMenuKey: (key: string | null) => void
  onToggleAccountsMenuArea: (area: 'sidebar' | 'footer' | null) => void
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  isDashboard,
  isHybrid,
  isDashboardMenuVisible,
  isLandscape,
  sidebarOnRight,
  primaryColor,
  secondaryColor,
  sidebarMenuItems,
  accountSubmenuItems,
  settingsMenuItem,
  activeWindowId,
  authToken,
  hoveredClosableMenuKey,
  openedAccountsMenuArea,
  sidebarAccountHubRef,
  getMenuItemColor,
  onWindowChange,
  onCloseAppWindow,
  onHoverClosableMenuKey,
  onToggleAccountsMenuArea,
}) => (
  <aside
    id="menubar"
    style={{
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
        const isActive = isAccountHubItem
          ? activeWindowId === 'accounts' || activeWindowId === 'members'
          : activeWindowId === item.key
        const isUserAppItem = item.key.startsWith('app:')
        const showMenuClose = isDashboard && isUserAppItem && (isActive || hoveredClosableMenuKey === item.key)
        const showAccountsSubmenu = isAccountHubItem && openedAccountsMenuArea === 'sidebar'

        return (
          <div
            key={item.key}
            ref={isAccountHubItem ? sidebarAccountHubRef : undefined}
            data-accounts-hub={isAccountHubItem ? 'sidebar' : undefined}
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              if (isDashboard && isUserAppItem) {
                onHoverClosableMenuKey(item.key)
              }
            }}
            onMouseLeave={() => {
              if (hoveredClosableMenuKey === item.key) {
                onHoverClosableMenuKey(null)
              }
            }}
          >
            <button
              title={item.label}
              onClick={() => {
                if (isAccountHubItem) {
                  onToggleAccountsMenuArea(openedAccountsMenuArea === 'sidebar' ? null : 'sidebar')
                  return
                }
                onWindowChange(item.key as WindowId)
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
                color: getMenuItemColor(isActive),
                boxShadow: 'none',
              }}
            >
              <span style={{ fontSize: isDashboard ? '0.85rem' : isHybrid ? '17px' : '21px', flexShrink: 0 }}>
                {withMenuIconColor(item.icon, getMenuItemColor(isActive))}
              </span>
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
                    onCloseAppWindow(item.key.slice(4))
                  }}
                  style={{
                    marginLeft: 'auto',
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    display: 'grid',
                    placeItems: 'center',
                    color: getMenuItemColor(isActive),
                    opacity: showMenuClose ? 1 : 0,
                    pointerEvents: showMenuClose ? 'auto' : 'none',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <CloseOutlined style={{ fontSize: '0.62rem' }} />
                </span>
              )}
            </button>
            <FloatingSubmenu
              open={showAccountsSubmenu}
              anchorRef={sidebarAccountHubRef}
              placement={sidebarOnRight ? 'left' : 'right'}
              zIndex={1200}
              menuStyle={{
                minWidth: '150px',
                padding: '0.35rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: primaryColor,
                boxShadow: '0 12px 26px rgba(15, 23, 42, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              {accountSubmenuItems.map((subItem) => (
                <button
                  key={subItem.key}
                  title={subItem.label}
                  onClick={() => {
                    onWindowChange(subItem.key)
                    onToggleAccountsMenuArea(null)
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
                    color: getMenuItemColor(activeWindowId === subItem.key),
                    fontSize: '0.75rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>
                    {withMenuIconColor(subItem.icon, getMenuItemColor(activeWindowId === subItem.key))}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subItem.label}
                  </span>
                </button>
              ))}
            </FloatingSubmenu>
          </div>
        )
      })}
    </div>

    <NotificationPanel
      authToken={authToken}
      isDashboard={isDashboard}
      iconColor={getMenuItemColor(false)}
      primaryColor={primaryColor}
    />

    <button
      title={settingsMenuItem.label}
      onClick={() => onWindowChange('settings')}
      style={{
        width: '100%',
        padding: isDashboard ? '0.45rem 0.65rem' : '0.5rem',
        borderRadius: '6px',
        border: 'none',
        background: activeWindowId === 'settings' ? secondaryColor : 'transparent',
        fontSize: '0.78rem',
        color: getMenuItemColor(activeWindowId === 'settings'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: isDashboard ? 'flex-start' : 'center',
        gap: '0.35rem',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: isDashboard ? '0.85rem' : '15px', flexShrink: 0 }}>
        {withMenuIconColor(settingsMenuItem.icon, getMenuItemColor(activeWindowId === 'settings'))}
      </span>
      {isDashboard && <span>Settings</span>}
    </button>
  </aside>
)
