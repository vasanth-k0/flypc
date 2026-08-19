import React from 'react'
import { NotificationPanel } from '../NotificationPanel'
import { withMenuIconColor, type MenuItem } from '../../utils/menuIcons'
import type { WindowId } from '../../types/dashboard'

export type WebNavItem = {
  key: string
  label: string
  icon?: React.ReactNode
}

export type WebLayoutNavProps = {
  isLandscape: boolean
  isWhitePalette: boolean
  whitePaletteChromeColor: string
  secondaryColor: string
  primaryColor: string
  webPrimaryNavItems: WebNavItem[]
  settingsMenuItem: MenuItem
  activeWindowId: WindowId
  activeLabel: string
  authToken: string
  isWebPortraitMenuOpen: boolean
  getMenuItemColor: (isActive: boolean) => string
  onWindowChange: (windowId: WindowId) => void
  onWebPortraitMenuOpenChange: (open: boolean) => void
}

export const WebLayoutNav: React.FC<WebLayoutNavProps> = ({
  isLandscape,
  isWhitePalette,
  whitePaletteChromeColor,
  secondaryColor,
  primaryColor,
  webPrimaryNavItems,
  settingsMenuItem,
  activeWindowId,
  activeLabel,
  authToken,
  isWebPortraitMenuOpen,
  getMenuItemColor,
  onWindowChange,
  onWebPortraitMenuOpenChange,
}) => (
  <nav
    aria-label="Web layout navigation"
    style={{
      position: 'relative',
      height: '4.5rem',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0 1rem',
      boxSizing: 'border-box',
      borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        flexShrink: 0,
        minWidth: isLandscape ? '9rem' : undefined,
        color: isWhitePalette ? whitePaletteChromeColor : '#ffffff',
        fontSize: '0.95rem',
        fontWeight: 600,
        letterSpacing: '0.08em',
      }}
    >
      <img src="/logo.png" alt="FlyPC" style={{ width: '1.8rem', height: '1.8rem', objectFit: 'contain' }} />
      <span>FlyPC</span>
    </div>

    {isLandscape && (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2.5rem',
          height: '100%',
          minWidth: 0,
        }}
      >
        {webPrimaryNavItems.map((item) => {
          const isActive = activeWindowId === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onWindowChange(item.key as WindowId)}
              style={{
                height: '100%',
                padding: '0 0.1rem',
                border: 'none',
                borderBottom: isActive ? `2px solid ${secondaryColor}` : '2px solid transparent',
                background: 'transparent',
                color: getMenuItemColor(isActive),
                fontSize: '0.76rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    )}

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        marginLeft: isLandscape ? 0 : 'auto',
        flexShrink: 0,
        height: isLandscape ? '100%' : undefined,
      }}
    >
      {!isLandscape && (
        <>
          <button
            type="button"
            aria-expanded={isWebPortraitMenuOpen}
            aria-controls="web-portrait-menu"
            onClick={() => onWebPortraitMenuOpenChange(!isWebPortraitMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.7rem',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              borderRadius: '4px',
              background: '#ffffff12',
              color: isWhitePalette ? whitePaletteChromeColor : '#ffffff',
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
              {webPrimaryNavItems.map((item) => {
                const isActive = activeWindowId === item.key
                return (
                  <button
                    key={item.key}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      onWindowChange(item.key as WindowId)
                      onWebPortraitMenuOpenChange(false)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.65rem',
                      border: 'none',
                      borderRadius: '3px',
                      background: isActive ? '#ffffff1f' : 'transparent',
                      color: getMenuItemColor(isActive),
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

      <NotificationPanel
        authToken={authToken}
        isDashboard={false}
        compact
        iconColor={getMenuItemColor(false)}
        primaryColor={primaryColor}
      />

      <button
        type="button"
        title={settingsMenuItem.label}
        aria-label={settingsMenuItem.label}
        onClick={() => onWindowChange('settings')}
        style={{
          height: isLandscape ? '100%' : undefined,
          padding: isLandscape ? '0 0.1rem' : '0.5rem',
          border: 'none',
          borderBottom: isLandscape && activeWindowId === 'settings'
            ? `2px solid ${secondaryColor}`
            : isLandscape
              ? '2px solid transparent'
              : undefined,
          borderRadius: isLandscape ? 0 : '6px',
          background: !isLandscape && activeWindowId === 'settings' ? 'rgba(148, 163, 184, 0.18)' : 'transparent',
          color: getMenuItemColor(activeWindowId === 'settings'),
          fontSize: isLandscape ? '0.76rem' : '15px',
          fontWeight: isLandscape ? 500 : undefined,
          letterSpacing: isLandscape ? '0.04em' : undefined,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isLandscape
          ? settingsMenuItem.label
          : withMenuIconColor(settingsMenuItem.icon, getMenuItemColor(activeWindowId === 'settings'))}
      </button>
    </div>
  </nav>
)
