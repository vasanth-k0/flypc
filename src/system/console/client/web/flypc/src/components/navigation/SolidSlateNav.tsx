import React from 'react'
import { FloatingSubmenu } from '../FloatingSubmenu'
import { NotificationPanel } from '../NotificationPanel'
import { withMenuIconColor, type MenuItem } from '../../utils/menuIcons'
import type { WindowId } from '../../types/dashboard'
import type { AccountSubmenuItem } from './SidebarNav'

export type SolidSlateNavProps = {
  primaryColor: string
  iconColor: string
  labelColor: string
  isWhitePalette: boolean
  sidebarMenuItems: MenuItem[]
  accountSubmenuItems: AccountSubmenuItem[]
  showAccountSubmenu: boolean
  settingsMenuItem: MenuItem
  activeWindowId: WindowId
  authToken: string
  openedAccountsMenuArea: 'sidebar' | 'footer' | null
  sidebarAccountHubRef: React.RefObject<HTMLDivElement | null>
  getMenuItemColor: (isActive: boolean) => string
  onWindowChange: (windowId: WindowId) => void
  onToggleAccountsMenuArea: (area: 'sidebar' | 'footer' | null) => void
}

const formatTopBarClock = (date: Date): string =>
  date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

const SolidSlateClock: React.FC = () => {
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time className="solid-slate-nav__clock" dateTime={now.toISOString()}>
      {formatTopBarClock(now)}
    </time>
  )
}

export const SolidSlateNav: React.FC<SolidSlateNavProps> = ({
  primaryColor,
  iconColor,
  labelColor,
  isWhitePalette,
  sidebarMenuItems,
  accountSubmenuItems,
  showAccountSubmenu,
  settingsMenuItem,
  activeWindowId,
  authToken,
  openedAccountsMenuArea,
  sidebarAccountHubRef,
  getMenuItemColor,
  onWindowChange,
  onToggleAccountsMenuArea,
}) => (
  <header
    id="menubar"
    className="solid-slate-nav"
    style={{
      ['--solid-slate-primary' as string]: primaryColor,
      ['--solid-slate-icon' as string]: iconColor,
      ['--solid-slate-label' as string]: labelColor,
    }}
  >
    <nav className="solid-slate-nav__left" aria-label="Main navigation">
      {sidebarMenuItems.map((item) => {
        const isAccountHubItem = item.key === 'account-hub'
        const isActive = isAccountHubItem
          ? activeWindowId === 'accounts' || activeWindowId === 'members'
          : activeWindowId === item.key
        const showAccountsSubmenu = isAccountHubItem && showAccountSubmenu && openedAccountsMenuArea === 'sidebar'

        return (
          <div
            key={item.key}
            ref={isAccountHubItem ? sidebarAccountHubRef : undefined}
            data-accounts-hub={isAccountHubItem ? 'sidebar' : undefined}
            className="solid-slate-nav__item-wrap"
          >
            <button
              type="button"
              title={item.label}
              aria-label={item.label}
              className={`solid-slate-nav__item${isActive ? ' solid-slate-nav__item--active' : ''}`}
              style={{ color: getMenuItemColor(isActive) }}
              onClick={() => {
                if (isAccountHubItem) {
                  if (showAccountSubmenu) {
                    onToggleAccountsMenuArea(openedAccountsMenuArea === 'sidebar' ? null : 'sidebar')
                    return
                  }
                  onWindowChange('accounts')
                  return
                }
                onWindowChange(item.key as WindowId)
              }}
            >
              <span className="solid-slate-nav__icon">
                {withMenuIconColor(item.icon, getMenuItemColor(isActive))}
              </span>
            </button>
            {showAccountSubmenu ? (
            <FloatingSubmenu
              open={showAccountsSubmenu}
              anchorRef={sidebarAccountHubRef}
              placement="bottom"
              zIndex={1200}
              menuStyle={{
                minWidth: '160px',
                padding: '0.35rem',
                borderRadius: '8px',
                border: isWhitePalette
                  ? '1px solid rgba(0, 0, 0, 0.1)'
                  : '1px solid rgba(255, 255, 255, 0.14)',
                background: 'var(--solid-slate-topbar, #24356f)',
                boxShadow: isWhitePalette
                  ? '0 12px 28px rgba(0, 0, 0, 0.12)'
                  : '0 12px 28px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                ['--solid-slate-label' as string]: labelColor,
                ['--solid-slate-icon' as string]: iconColor,
              }}
            >
              {accountSubmenuItems.map((subItem) => (
                <button
                  key={subItem.key}
                  type="button"
                  title={subItem.label}
                  className={`solid-slate-nav__submenu-item${activeWindowId === subItem.key ? ' solid-slate-nav__submenu-item--active' : ''}`}
                  onClick={() => {
                    onWindowChange(subItem.key)
                    onToggleAccountsMenuArea(null)
                  }}
                >
                  <span className="solid-slate-nav__icon solid-slate-nav__icon--small">
                    {withMenuIconColor(subItem.icon, iconColor)}
                  </span>
                  <span className="solid-slate-nav__submenu-label">{subItem.label}</span>
                </button>
              ))}
            </FloatingSubmenu>
            ) : null}
          </div>
        )
      })}
    </nav>

    <div className="solid-slate-nav__center">
      <SolidSlateClock />
    </div>

    <div className="solid-slate-nav__right">
      <NotificationPanel
        authToken={authToken}
        isDashboard={false}
        iconColor={iconColor}
        primaryColor={primaryColor}
      />

      <button
        type="button"
        title={settingsMenuItem.label}
        aria-label={settingsMenuItem.label}
        className={`solid-slate-nav__utility${activeWindowId === 'settings' ? ' solid-slate-nav__utility--active' : ''}`}
        onClick={() => onWindowChange('settings')}
      >
        <span className="solid-slate-nav__icon">
          {withMenuIconColor(settingsMenuItem.icon, iconColor)}
        </span>
      </button>
    </div>
  </header>
)
