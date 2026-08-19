import React from 'react'
import { Button, Tabs, Typography } from 'antd'
import { GlobalOutlined, BgColorsOutlined, LayoutOutlined } from '@ant-design/icons'
import { DomainManager } from './DomainManager'
import { ColorPalette } from '../globals/ColorPalette'
import type { LayoutMode } from '../store/settingsSlice'

const { Text } = Typography

const WALLPAPER_IDS = [0, 1, 3, 5, 7, 10, 15, 17, 19, 21, 23, 25, 26, 27, 30, 33]

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  marginBottom: '0.5rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 500,
}

type SystemSettingsPanelProps = {
  isLandscape: boolean
  isDashboard: boolean
  layoutMode: LayoutMode
  controlsSide: 'left' | 'right'
  activeTheme: string
  activeWallp: number
  primaryColor: string
  isAdmin: boolean
  authToken: string
  onLayoutModeChange: (mode: LayoutMode) => void
  onControlsSideChange: (side: 'left' | 'right') => void
  onColorPaletteChange: (themeName: string) => void
  onWallpaperChange: (id: number) => void
  onDomainSetupComplete: () => void
}

export const SystemSettingsPanel: React.FC<SystemSettingsPanelProps> = ({
  isLandscape,
  isDashboard,
  layoutMode,
  controlsSide,
  activeTheme,
  activeWallp,
  primaryColor,
  isAdmin,
  authToken,
  onLayoutModeChange,
  onControlsSideChange,
  onColorPaletteChange,
  onWallpaperChange,
  onDomainSetupComplete,
}) => {
  const domainTab = {
    key: 'domain',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <GlobalOutlined />
        Domain
      </span>
    ),
    children: (
      <div style={{ padding: isLandscape ? '0 0.5rem 0 0' : '0.5rem 0 0' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: '1rem', fontSize: '0.78rem' }}>
          Register your RHost domain, configure HTTPS, and complete initial node setup.
        </Text>
        <DomainManager
          isAdmin={isAdmin}
          authToken={authToken}
          primaryColor={primaryColor}
          onSetupComplete={onDomainSetupComplete}
        />
      </div>
    ),
  }

  const layoutTab = {
    key: 'layout',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <LayoutOutlined />
        Layout
      </span>
    ),
    children: (
      <div style={{ display: 'grid', gap: '1.25rem', padding: isLandscape ? '0 0.5rem 0 0' : '0.5rem 0 0' }}>
        <Text type="secondary" style={{ fontSize: '0.78rem' }}>
          Control console layout and where application controls appear on screen.
        </Text>

        <div>
          <h3 style={sectionTitleStyle}>Layout Mode</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(['desktop', 'dashboard', 'hybrid-console', 'sharp', 'web'] as LayoutMode[]).map((mode) => (
              <Button
                key={mode}
                onClick={() => onLayoutModeChange(mode)}
                type="text"
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  border: layoutMode === mode ? `2px solid ${primaryColor}` : '1px solid rgba(0,0,0,0.15)',
                  background: layoutMode === mode ? `${primaryColor}15` : 'transparent',
                  color: layoutMode === mode ? primaryColor : '#475569',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
              >
                {mode.replace('-', ' ')}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 style={sectionTitleStyle}>Application Controls</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(['left', 'right'] as const).map((side) => (
              <Button
                key={side}
                onClick={() => onControlsSideChange(side)}
                type="text"
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '8px',
                  border: controlsSide === side ? `2px solid ${primaryColor}` : '1px solid rgba(0,0,0,0.15)',
                  background: controlsSide === side ? `${primaryColor}15` : 'transparent',
                  color: controlsSide === side ? primaryColor : '#475569',
                  fontWeight: 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
              >
                {side}
              </Button>
            ))}
          </div>
        </div>
      </div>
    ),
  }

  const themeTab = {
    key: 'theme',
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <BgColorsOutlined />
        Theme
      </span>
    ),
    children: (
      <div style={{ display: 'grid', gap: '1.25rem', padding: isLandscape ? '0 0.5rem 0 0' : '0.5rem 0 0' }}>
        <Text type="secondary" style={{ fontSize: '0.78rem' }}>
          Pick a color palette and desktop wallpaper for this console.
        </Text>

        <div>
          <h3 style={sectionTitleStyle}>Color Palette</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isLandscape ? 'repeat(5, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
              gap: '0.5rem',
            }}
          >
            {Object.keys(ColorPalette.options).map((themeName) => {
              const isActive = activeTheme === themeName
              const themeColors = ColorPalette.options[themeName as keyof typeof ColorPalette.options]
              return (
                <Button
                  key={themeName}
                  onClick={() => onColorPaletteChange(themeName)}
                  type="text"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: isActive ? `2px solid ${themeColors[0]}` : '1px solid rgba(0,0,0,0.08)',
                    background: isActive ? `${themeColors[0]}15` : 'rgba(0,0,0,0.02)',
                    color: '#334155',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 400 }}>{themeName}</span>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: themeColors[0],
                      border: '1px solid rgba(255,255,255,0.3)',
                    }}
                  />
                </Button>
              )
            })}
          </div>
        </div>

        {!isDashboard ? (
          <div
            style={{
              width: isLandscape ? 'min(100%, 420px)' : '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              ['--wallpaper-accent' as string]: primaryColor,
            }}
          >
            <h3 style={{ ...sectionTitleStyle, alignSelf: 'flex-start' }}>Wallpaper</h3>

            <div style={{ marginBottom: 0, width: '100%' }}>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>Active</p>
              <div
                style={{
                  width: '100%',
                  height: isLandscape ? '140px' : '160px',
                  borderRadius: 0,
                  overflow: 'hidden',
                  border: 'none',
                  boxShadow: 'none',
                  position: 'relative',
                }}
              >
                <img
                  src={`/resources/vx-${activeWallp}.webp`}
                  alt={`Wallpaper ${activeWallp}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(6px)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 0,
                    fontWeight: 500,
                  }}
                >
                  vx-{activeWallp}
                </div>
              </div>
            </div>

            <div
              className="wallpaper-scroll"
              style={{
                width: '100%',
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '4px',
                overflowX: 'auto',
                overflowY: 'hidden',
                padding: '2px 0',
                marginTop: '0.5rem',
              }}
            >
              {WALLPAPER_IDS.filter((id) => id !== activeWallp).map((id) => (
                <Button
                  key={id}
                  onClick={() => onWallpaperChange(id)}
                  title={`vx-${id}`}
                  type="text"
                  style={{
                    flex: '0 0 auto',
                    width: isLandscape ? '96px' : '110px',
                    padding: 0,
                    border: '2px solid transparent',
                    borderRadius: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'none',
                    transition: 'border-color 0.2s, transform 0.2s',
                    height: isLandscape ? '58px' : '67px',
                    display: 'block',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryColor
                    e.currentTarget.style.transform = 'scale(1.04)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  <img
                    src={`/resources/vx-${id}.webp`}
                    alt={`Wallpaper ${id}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '5px',
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.3rem',
                      borderRadius: 0,
                    }}
                  >
                    vx-{id}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
  }

  return (
    <Tabs
      tabPosition={isLandscape ? 'left' : 'top'}
      defaultActiveKey="domain"
      items={[domainTab, layoutTab, themeTab]}
      style={{ minHeight: isLandscape ? 420 : undefined }}
      tabBarStyle={
        isLandscape
          ? { minWidth: 132, paddingTop: '0.25rem' }
          : { marginBottom: '0.5rem' }
      }
    />
  )
}
