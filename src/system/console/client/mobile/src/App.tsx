import React from 'react'
import { Button, Input, Switch } from 'antd'
import {
  CloseOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import { StatusBar } from '@capacitor/status-bar'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'
import {
  addEndpoint,
  closePanel,
  refreshEndpointStatus,
  removeEndpoint,
  setActiveEndpoint,
  setPortraitLocked,
  togglePanel
} from './store/endpointSlice'

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { endpoints, panelOpen, portraitLocked } = useSelector((state: RootState) => state.endpoint)
  const [candidateUrl, setCandidateUrl] = React.useState('')
  const [iframeLoaded, setIframeLoaded] = React.useState(false)
  const [showLoadHint, setShowLoadHint] = React.useState(false)
  const [dismissedHint, setDismissedHint] = React.useState(false)

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
    // Keep webview immersive so content can overlap status/system bars.
    void StatusBar.setOverlaysWebView({ overlay: true })
    void StatusBar.hide()
  }, [])

  React.useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lock({
          orientation: portraitLocked ? 'portrait' : 'landscape',
        })
      } catch {
        // Ignore orientation-lock failures on unsupported platforms.
      }
    }

    void lockOrientation()
  }, [portraitLocked])

  React.useEffect(() => {
    const removePromise = CapApp.addListener('backButton', () => {
      // Block OS back-exit so app keeps running unless user uses explicit close action.
      if (panelOpen) {
        dispatch(closePanel())
      }
    })

    return () => {
      void removePromise.then((listener) => listener.remove())
    }
  }, [dispatch, panelOpen])

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
    window.location.reload()
  }

  const onCloseApp = () => {
    if (Capacitor.getPlatform() === 'android') {
      CapApp.exitApp()
      return
    }

    dispatch(closePanel())
  }

  return (
    <div className="shell-root mobile-root">
      <header className="title-bar mobile-title-bar">
        <div className="title-bar__brand">
          <span className="title-bar__dot" />
          <span>FlyPC</span>
        </div>

        <div className="title-bar__actions">
          <Button
            className="title-bar__icon-button"
            onClick={() => dispatch(togglePanel())}
            aria-label={panelOpen ? 'Hide settings panel' : 'Open settings panel'}
            title={panelOpen ? 'Hide Settings' : 'Open Settings'}
            type="text"
            shape="circle"
            icon={<SettingOutlined className="title-bar__icon" />}
          />
          <Button
            className="title-bar__icon-button"
            onClick={onReloadApp}
            aria-label="Reload app"
            title="Reload App"
            type="text"
            shape="circle"
            icon={<ReloadOutlined className="title-bar__icon" />}
          />
          <Button
            className="title-bar__icon-button"
            onClick={onCloseApp}
            aria-label="Close app"
            title="Close App"
            type="text"
            shape="circle"
            icon={<CloseOutlined className="title-bar__icon" />}
          />
        </div>
      </header>

      <main className="viewport-area">
        {activeEndpoint ? (
          <>
            <iframe
              className="shell-viewport"
              src={activeEndpoint}
              title="FlyPC mobile viewport"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={() => {
                setIframeLoaded(true)
                setShowLoadHint(false)
              }}
              onError={() => {
                setIframeLoaded(false)
                setDismissedHint(false)
                setShowLoadHint(true)
              }}
            />
            {showLoadHint && !dismissedHint && (
              <div className="viewport-hint">
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
        <Button
          className="panel-close"
          onClick={() => dispatch(closePanel())}
          aria-label="Close settings"
          type="text"
          shape="circle"
          icon={<CloseOutlined />}
        />

        <div className="settings-content">
          <div className="logo-wrap">
            <div className="logo-circle" />
            <p>FLYPC</p>
          </div>

          <div className="endpoint-entry">
            <Input
              className="endpoint-input"
              value={candidateUrl}
              onChange={(event) => setCandidateUrl(event.target.value)}
              placeholder="www.flypc.in or your-host"
            />
            <Button
              className="endpoint-add-btn"
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
                <Button className="endpoint-main" onClick={() => dispatch(setActiveEndpoint(entry.url))} type="text">
                  <span className={`dot ${entry.status}`} />
                  <span>{entry.url}</span>
                </Button>
                <Button
                  className="endpoint-remove"
                  onClick={() => dispatch(removeEndpoint(entry.url))}
                  icon={<DeleteOutlined />}
                  shape="circle"
                  danger
                  aria-label={`Remove ${entry.url}`}
                />
              </div>
            ))}
          </div>

          <div className="orientation-switch">
            <Switch
              checked={portraitLocked}
              checkedChildren="Portrait"
              unCheckedChildren="Landscape"
              onChange={(checked) => dispatch(setPortraitLocked(checked))}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}

export default App
