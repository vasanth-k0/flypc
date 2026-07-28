import React from 'react'
import { Button, Input, Switch } from 'antd'
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import { ColorPalette } from '../../web/flypc/src/globals/ColorPalette'
import { FlyPCLogo } from './components/FlyPCLogo'
import {
  addEndpoint,
  closePanel,
  refreshEndpointStatus,
  removeEndpoint,
  setActiveEndpoint,
  setOrientation,
  togglePanel
} from './store/endpointSlice'

declare global {
  interface Window {
    flypcDesktop?: {
      closeWindow: () => Promise<void>
      setOrientation: (orientation: 'portrait' | 'landscape') => Promise<void>
      toggleFullScreen: () => Promise<boolean>
    }
  }
}

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { endpoints, panelOpen, orientation } = useSelector((state: RootState) => state.endpoint)
  const [candidateUrl, setCandidateUrl] = React.useState('')
  const [iframeRevision, setIframeRevision] = React.useState(0)
  const [iframeLoaded, setIframeLoaded] = React.useState(false)
  const [showLoadHint, setShowLoadHint] = React.useState(false)
  const [dismissedHint, setDismissedHint] = React.useState(false)
  const [titleBarColor, setTitleBarColor] = React.useState(ColorPalette.primary)
  const fallbackVisitedRef = React.useRef<Set<string>>(new Set())

  const activeEntry = endpoints.find((entry) => entry.active)
  const activeEndpoint = activeEntry?.url || ''

  React.useEffect(() => {
    const urls = endpoints.map((entry) => entry.url)
    dispatch(refreshEndpointStatus(urls))

    const handle = window.setInterval(() => {
      dispatch(refreshEndpointStatus(urls))
    }, 7000)

    return () => {
      window.clearInterval(handle)
    }
  }, [dispatch, endpoints])

  React.useEffect(() => {
    if (!window.flypcDesktop) {
      return
    }
    void window.flypcDesktop.setOrientation(orientation)
  }, [orientation])

  React.useEffect(() => {
    let cancelled = false

    const loadThemeColor = async () => {
      try {
        const response = await fetch('http://localhost:3000/system/theme', {
          headers: { Accept: 'application/json' },
        })

        if (!response.ok) {
          throw new Error(`Theme request failed: ${response.status}`)
        }

        const payload = (await response.json()) as { active?: string }
        const themeName = String(payload.active ?? 'Geekblue') as keyof typeof ColorPalette.options
        const nextColor = ColorPalette.options[themeName]?.[0] ?? ColorPalette.primary

        if (!cancelled) {
          setTitleBarColor(nextColor)
        }
      } catch {
        if (!cancelled) {
          // preserve current color on error
        }
      }
    }

    void loadThemeColor()
    const interval = window.setInterval(loadThemeColor, 1500)

    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'FLYPC_THEME_CHANGED') {
        const themeName = String(event.data.themeName ?? 'Geekblue') as keyof typeof ColorPalette.options
        const nextColor = (event.data.primaryColor as string) || ColorPalette.options[themeName]?.[0] || ColorPalette.primary
        if (!cancelled) {
          setTitleBarColor(nextColor)
        }
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  React.useEffect(() => {
    if (!activeEndpoint) {
      setIframeLoaded(false)
      setShowLoadHint(true)
      return
    }

    setIframeLoaded(false)
    setShowLoadHint(false)
    setDismissedHint(false)

    const handle = window.setTimeout(() => {
      setShowLoadHint(true)
    }, 4500)

    return () => {
      window.clearTimeout(handle)
    }
  }, [activeEndpoint])

  React.useEffect(() => {
    fallbackVisitedRef.current = new Set()
  }, [endpoints.length])

  React.useEffect(() => {
    if (!showLoadHint || dismissedHint) {
      return
    }

    const handle = window.setTimeout(() => {
      setDismissedHint(true)
    }, 3000)

    return () => {
      window.clearTimeout(handle)
    }
  }, [showLoadHint, dismissedHint])

  const onAdd = () => {
    dispatch(addEndpoint(candidateUrl))
    setCandidateUrl('')
  }

  const onReloadApp = () => {
    setIframeRevision((current) => current + 1)
  }

  const tryFallbackEndpoint = React.useCallback(() => {
    if (!activeEndpoint || endpoints.length <= 1) {
      return false
    }

    const visited = fallbackVisitedRef.current
    visited.add(activeEndpoint)

    const next = endpoints.find((entry) => !visited.has(entry.url))
    if (!next) {
      return false
    }

    dispatch(setActiveEndpoint(next.url))
    return true
  }, [activeEndpoint, dispatch, endpoints])

  return (
    <div className="shell-root">
      <Button
        className={`sidebar-handle no-drag ${panelOpen ? 'open' : ''}`}
        onClick={() => dispatch(panelOpen ? closePanel() : togglePanel())}
        aria-label={panelOpen ? 'Hide settings panel' : 'Open settings panel'}
        title={panelOpen ? 'Hide Settings' : 'Open Settings'}
        type="text"
        shape="circle"
        style={{ background: titleBarColor }}
        icon={panelOpen ? <CloseOutlined className="sidebar-handle__icon" /> : <SettingOutlined className="sidebar-handle__icon" />}
      >
        <span className="sidebar-handle__bubble" />
      </Button>

      {panelOpen && <div className="sidebar-overlay" onClick={() => dispatch(closePanel())} />}

      <main className="viewport-area">
        {activeEndpoint ? (
          <>
            <iframe
              key={`${activeEndpoint}-${iframeRevision}`}
              className="shell-viewport"
              src={activeEndpoint}
              title="FlyPC viewport"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={() => {
                fallbackVisitedRef.current.clear()
                setIframeLoaded(true)
                setShowLoadHint(false)
              }}
              onError={() => {
                setIframeLoaded(false)
                setDismissedHint(false)
                if (tryFallbackEndpoint()) {
                  return
                }
                setShowLoadHint(true)
              }}
            />
            {showLoadHint && !dismissedHint && (
              <div className="viewport-hint no-drag">
                <Button
                  className="viewport-hint__close"
                  aria-label="Dismiss endpoint notification"
                  onClick={() => setDismissedHint(true)}
                  type="text"
                  icon={<CloseOutlined />}
                />
                <h3>Endpoint did not render yet.</h3>
                <p>Current endpoint: {activeEndpoint}</p>
                <p>
                  Open settings and confirm the URL. If the site blocks iframe embedding,
                  use your FlyPC host endpoint instead.
                </p>
                <p>Status check: {activeEntry?.status ?? 'offline'}</p>
                {!iframeLoaded && (
                  <Button type="primary" onClick={() => dispatch(togglePanel())}>
                    Open Settings
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">No endpoint selected.</div>
        )}
      </main>

      <aside className={`settings-panel ${panelOpen ? 'open' : ''}`}>
        <div className="settings-content">
          <div className="settings-toolbar no-drag">
            <div className="settings-toolbar__meta">
              <span className="settings-toolbar__label">Active endpoint</span>
              <span className="settings-toolbar__value">{activeEndpoint || 'None selected'}</span>
            </div>
            <div className="settings-toolbar__actions">
              <Button
                className="settings-toolbar__button no-drag"
                onClick={onReloadApp}
                aria-label="Reload app"
                title="Reload App"
                type="text"
                shape="circle"
                icon={<ReloadOutlined />}
              />
              <Button
                className="settings-toolbar__button no-drag"
                onClick={() => dispatch(closePanel())}
                aria-label="Hide settings"
                title="Hide Settings"
                type="text"
                shape="circle"
                icon={<CloseOutlined />}
              />
            </div>
          </div>

          <div className="logo-wrap">
            <FlyPCLogo width={110} height={110} />
            <p>FLYPC</p>
          </div>

          <div className="endpoint-entry">
            <Input
              className="no-drag endpoint-input"
              value={candidateUrl}
              onChange={(event) => setCandidateUrl(event.target.value)}
              placeholder="www.flypc.in or your-host"
            />
            <Button
              className="no-drag endpoint-add-btn"
              onClick={onAdd}
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              aria-label="Add host endpoint"
            />
          </div>

          <div className="endpoint-list">
            {endpoints.map((entry) => (
              <div key={entry.url} className="endpoint-row">
                <Button
                  className="endpoint-main no-drag"
                  onClick={() => dispatch(setActiveEndpoint(entry.url))}
                  type="text"
                >
                  <span className={`dot ${entry.status}`} />
                  <span>{entry.url}</span>
                </Button>
                <Button
                  className="endpoint-remove no-drag"
                  onClick={() => dispatch(removeEndpoint(entry.url))}
                  icon={<DeleteOutlined />}
                  shape="circle"
                  danger
                  aria-label={`Remove ${entry.url}`}
                />
              </div>
            ))}
          </div>

          <div className="orientation-switch no-drag">
            <Switch
              checked={orientation === 'portrait'}
              onChange={(checked) => dispatch(setOrientation(checked ? 'portrait' : 'landscape'))}
            />
            <span className="orientation-label">
              {orientation === 'portrait' ? 'portrait' : 'landscape'}
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default App
