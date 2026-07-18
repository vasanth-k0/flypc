import React from 'react'
import './App.css'
import { useGetSettingsQuery } from './store/settingsApi'
import { useGetThemeQuery } from './store/themeApi'
import { useAppSelector } from './store/hooks'
import Dashboard from './Dashboard'

function App() {
  // Populate the Redux store — actual values come from settingsState below
  useGetSettingsQuery()
  useGetThemeQuery()

  const settingsState = useAppSelector((state) => state.settings)

  const layout = settingsState.ui
  const wallpaperUrl = `/resources/vx-${settingsState.wallp}.webp`
  const isDashboard = layout === 'dashboard'
  const isHybrid = layout === 'hybrid-console'

  const screenStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#ffffff',
    padding: isHybrid ? '10px' : '0',
    boxSizing: 'border-box',
  }

  const consoleStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundImage: isDashboard ? 'none' : `url(${wallpaperUrl})`,
    backgroundColor: isDashboard ? '#ffffff' : 'transparent',
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
