import React from 'react'
import { Button, Input } from 'antd'
import { ColorPalette } from '../../globals/ColorPalette'
import { LAYOUT_MODES, type LayoutMode } from '../../store/settingsSlice'
import { WALLPAPER_IDS } from '../../generated/wallpaperIds'
import { getWallpaperUrl, resolveWallpaperId } from '../../utils/wallpapers'

const WALLPAPER_INITIAL_COUNT = 6
const WALLPAPER_LOAD_BATCH = 8

type WallpaperContextPanelProps = {
  activeWallp: number
  primaryColor: string
  onWallpaperChange: (id: number) => void
}

export const WallpaperContextPanel: React.FC<WallpaperContextPanelProps> = ({
  activeWallp,
  primaryColor,
  onWallpaperChange,
}) => {
  const resolvedActiveWallp = resolveWallpaperId(activeWallp)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const [loadedCount, setLoadedCount] = React.useState(WALLPAPER_INITIAL_COUNT)

  React.useEffect(() => {
    setLoadedCount(WALLPAPER_INITIAL_COUNT)
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0
    }
  }, [])

  const loadMore = React.useCallback(() => {
    setLoadedCount((current) => Math.min(current + WALLPAPER_LOAD_BATCH, WALLPAPER_IDS.length))
  }, [])

  const handleScroll = React.useCallback(() => {
    const container = bodyRef.current
    if (!container) {
      return
    }

    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 12) {
      loadMore()
    }
  }, [loadMore])

  const visibleIds = WALLPAPER_IDS.slice(0, loadedCount)

  return (
    <div
      ref={bodyRef}
      className="flypc-context-menu-hover-pane__body"
      onScroll={handleScroll}
    >
      <div className="flypc-context-menu-wallpaper-grid">
        {visibleIds.map((id) => {
          const isActive = id === resolvedActiveWallp
          return (
            <button
              key={id}
              type="button"
              className="flypc-context-menu-wallpaper-item"
              onClick={() => onWallpaperChange(id)}
              title={`vx-${id}`}
              aria-pressed={isActive}
              aria-label={`Wallpaper ${id}`}
              style={{
                borderColor: isActive ? primaryColor : 'rgba(0, 0, 0, 0.08)',
                boxShadow: isActive ? `0 0 0 1px ${primaryColor}` : 'none',
              }}
            >
              <img
                src={getWallpaperUrl(id)}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

type ColorContextPanelProps = {
  activeTheme: string
  onColorPaletteChange: (themeName: string) => void
}

export const ColorContextPanel: React.FC<ColorContextPanelProps> = ({
  activeTheme,
  onColorPaletteChange,
}) => (
  <div className="flypc-context-menu-hover-pane__body flypc-context-menu-palette-grid">
    {Object.keys(ColorPalette.options).map((themeName) => {
      const isActive = activeTheme === themeName
      const themeColors = ColorPalette.options[themeName as keyof typeof ColorPalette.options]
      return (
        <button
          key={themeName}
          type="button"
          className="color-palette-option flypc-context-menu-palette-option"
          onClick={() => onColorPaletteChange(themeName)}
          aria-pressed={isActive}
          title={themeName}
          aria-label={`${themeName} color palette`}
          style={{
            borderColor: isActive ? themeColors[0] : 'rgba(0, 0, 0, 0.08)',
            background: isActive ? `${themeColors[0]}15` : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <span className="color-palette-option__swatch">
            <span className="color-palette-option__swatch-primary" style={{ background: themeColors[0] }} />
            <span className="color-palette-option__swatch-secondary" style={{ background: themeColors[1] }} />
          </span>
        </button>
      )
    })}
  </div>
)

type LayoutContextPanelProps = {
  layoutMode: LayoutMode
  primaryColor: string
  onLayoutModeChange: (mode: LayoutMode) => void
}

export const LayoutContextPanel: React.FC<LayoutContextPanelProps> = ({
  layoutMode,
  primaryColor,
  onLayoutModeChange,
}) => (
  <div className="flypc-context-menu-hover-pane__body flypc-context-menu-layout-grid">
    {LAYOUT_MODES.map((mode) => (
      <Button
        key={mode}
        onClick={() => onLayoutModeChange(mode)}
        type="text"
        aria-pressed={layoutMode === mode}
        style={{
          padding: '0.4rem 0.55rem',
          borderRadius: '6px',
          border: layoutMode === mode ? `2px solid ${primaryColor}` : '1px solid rgba(0, 0, 0, 0.12)',
          background: layoutMode === mode ? `${primaryColor}12` : 'transparent',
          color: layoutMode === mode ? primaryColor : '#475569',
          fontWeight: 400,
          cursor: 'pointer',
          textTransform: 'capitalize',
          fontSize: '0.74rem',
          lineHeight: 1.2,
          whiteSpace: 'normal',
          height: 'auto',
        }}
      >
        {mode.replace(/-/g, ' ')}
      </Button>
    ))}
  </div>
)

type LoginContextPanelProps = {
  loginUsername: string
  loginPassword: string
  accountError?: string
  onLoginUsernameChange: (value: string) => void
  onLoginPasswordChange: (value: string) => void
  onLoginSubmit: () => void
}

export const LoginContextPanel: React.FC<LoginContextPanelProps> = ({
  loginUsername,
  loginPassword,
  accountError,
  onLoginUsernameChange,
  onLoginPasswordChange,
  onLoginSubmit,
}) => (
  <div className="flypc-context-menu-hover-pane__body flypc-context-menu-login-form">
    {accountError ? (
      <div style={{ color: '#b91c1c', fontSize: '0.72rem' }}>{accountError}</div>
    ) : null}
    <Input
      value={loginUsername}
      onChange={(event) => onLoginUsernameChange(event.target.value)}
      placeholder="Username"
      size="small"
    />
    <Input.Password
      value={loginPassword}
      onChange={(event) => onLoginPasswordChange(event.target.value)}
      placeholder="Password"
      size="small"
    />
    <Button type="primary" size="small" block onClick={onLoginSubmit}>
      Log in
    </Button>
  </div>
)
