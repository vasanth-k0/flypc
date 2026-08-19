import React from 'react'
import './App.css'
import { useGetSettingsQuery } from './store/settingsApi'
import { useGetThemeQuery } from './store/themeApi'
import { useAppSelector } from './store/hooks'
import Dashboard from './Dashboard'

const darkenHex = (color: string, amount: number) => {
  const value = color.replace('#', '')
  if (!/^[\da-f]{6}$/i.test(value)) return '#171717'

  const toDarkChannel = (channel: string) =>
    Math.round(parseInt(channel, 16) * (1 - amount)).toString(16).padStart(2, '0')

  return `#${toDarkChannel(value.slice(0, 2))}${toDarkChannel(value.slice(2, 4))}${toDarkChannel(value.slice(4, 6))}`
}

function App() {
  // Do not reveal the console until persisted settings and theme values are available.
  const settingsQuery = useGetSettingsQuery()
  const themeQuery = useGetThemeQuery()

  const settingsState = useAppSelector((state) => state.settings)
  const primaryColor = useAppSelector((state) => state.theme.primary) || '#597ef7'

  const layout = settingsState.ui
  const wallpaperUrl = `/resources/vx-${settingsState.wallp}.webp`
  const isDashboard = layout === 'dashboard'
  const isWeb = layout === 'web'
  const webOverlayStart = darkenHex(primaryColor, 0.7)
  const webOverlayEnd = darkenHex(primaryColor, 0.84)
  const isBooting = !(
    (settingsQuery.isSuccess || settingsQuery.isError)
    && (themeQuery.isSuccess || themeQuery.isError)
  )

  React.useEffect(() => {
    document.documentElement.style.setProperty('--scrollbar-color', primaryColor)
  }, [primaryColor])

  if (isBooting) {
    return (
      <main className="startup-screen" aria-label="Loading FlyPC">
        <div className="startup-content">
          <img className="startup-logo" src="/logo.png" alt="FlyPC" />
          <div className="startup-progress" role="progressbar" aria-label="Loading system settings">
            <div className="startup-progress-fill" />
          </div>
        </div>
      </main>
    )
  }

  const screenStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#ffffff',
    padding: '0',
    boxSizing: 'border-box',
  }

  const consoleStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundImage: isDashboard
      ? 'none'
      : isWeb
        ? `linear-gradient(135deg, ${webOverlayStart}e6 0%, ${webOverlayEnd}ed 100%), url(${wallpaperUrl})`
        : `url(${wallpaperUrl})`,
    backgroundColor: isDashboard ? '#ffffff' : '#000000',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    transition: 'background 0.3s ease, background-color 0.3s ease',
  }

  return (
    <div id="screen" style={screenStyle}>
      <div id="console" style={consoleStyle}>
        <Dashboard />
      </div>
    </div>
  )
}

export default App
