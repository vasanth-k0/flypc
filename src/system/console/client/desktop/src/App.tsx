import React from 'react'
import { Button, Input, Switch } from 'antd'
import {
  CloseCircleOutlined,
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
      dragMove: (dx: number, dy: number) => void
      clickAt: (x: number, y: number) => Promise<void>
    }
  }
}

const DRAG_HOLD_MS = 300
const DRAG_MOVE_START_PX = 6
const DRAG_MIN_HOLD_BEFORE_MOVE_MS = 120

const isFlypcEndpointUrl = (endpoint: string): boolean => {
  const raw = endpoint.trim()
  if (!raw) {
    return false
  }

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const host = new URL(normalized).hostname.toLowerCase()
    return host === 'flypc.in' || host === 'www.flypc.in'
  } catch {
    return /(^|:\/\/)(www\.)?flypc\.in(\/|$)/i.test(raw)
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
  const isActiveFlypcEndpoint = isFlypcEndpointUrl(activeEndpoint)
  const showFlypcOfflineMessage = Boolean(
    isActiveFlypcEndpoint
    && activeEntry?.status === 'offline'
  )

  const shellRef = React.useRef<HTMLDivElement>(null)
  const dragOverlayRef = React.useRef<HTMLDivElement>(null)

  // Manual IPC drag — CSS -webkit-app-region: drag is broken on Linux with
  // transparent + GPU-disabled frameless windows. Press-and-hold (or hold then
  // move) starts drag; quick taps on the iframe shim forward clicks via IPC.
  React.useEffect(() => {
    const shell = shellRef.current
    if (!shell || !window.flypcDesktop) return

    let dragging = false
    let pendingHold = false
    let holdTimer: ReturnType<typeof setTimeout> | null = null
    let holdStartTime = 0
    let holdStartX = 0
    let holdStartY = 0
    let clickClientX = 0
    let clickClientY = 0
    let startedOnShim = false
    let captureElement: HTMLElement | null = null
    let activePointerId: number | null = null
    let lastX = 0
    let lastY = 0

    const clearHoldTimer = () => {
      if (holdTimer !== null) {
        clearTimeout(holdTimer)
        holdTimer = null
      }
    }

    const activateDragCapture = () => {
      dragOverlayRef.current?.classList.add('drag-capture-overlay--active')
      shell.classList.add('is-dragging')
    }

    const deactivateDragCapture = () => {
      dragOverlayRef.current?.classList.remove('drag-capture-overlay--active')
      shell.classList.remove('is-dragging')
    }

    const isAlwaysInteractive = (target: EventTarget | null): boolean => {
      let el = target as HTMLElement | null
      while (el && el !== shell) {
        const tag = el.tagName?.toLowerCase()
        if (
          tag === 'button' ||
          tag === 'input' ||
          tag === 'a' ||
          tag === 'select' ||
          tag === 'textarea' ||
          el.getAttribute('role') === 'button' ||
          el.getAttribute('role') === 'slider' ||
          el.getAttribute('role') === 'switch' ||
          el.classList.contains('no-drag') ||
          el.getAttribute('draggable') === 'true'
        ) {
          return true
        }
        el = el.parentElement
      }
      return false
    }

    const isShimTarget = (target: EventTarget | null): boolean =>
      (target as HTMLElement | null)?.classList?.contains('iframe-drag-shim') ?? false

    const releaseCapturedPointer = () => {
      if (captureElement && activePointerId !== null) {
        try {
          captureElement.releasePointerCapture(activePointerId)
        } catch {
          // pointer may already be released
        }
      }
      captureElement = null
      activePointerId = null
    }

    const startDrag = (screenX: number, screenY: number) => {
      if (dragging) return
      dragging = true
      pendingHold = false
      clearHoldTimer()
      lastX = screenX
      lastY = screenY
      activateDragCapture()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (isAlwaysInteractive(e.target)) return

      pendingHold = true
      dragging = false
      startedOnShim = isShimTarget(e.target)
      holdStartTime = Date.now()
      holdStartX = e.screenX
      holdStartY = e.screenY
      clickClientX = e.clientX
      clickClientY = e.clientY
      activePointerId = e.pointerId
      captureElement = startedOnShim ? (e.target as HTMLElement) : shell

      try {
        captureElement.setPointerCapture(e.pointerId)
      } catch {
        captureElement = null
        activePointerId = null
      }

      clearHoldTimer()
      holdTimer = setTimeout(() => {
        holdTimer = null
        if (pendingHold && !dragging) {
          startDrag(holdStartX, holdStartY)
        }
      }, DRAG_HOLD_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const dx = e.screenX - lastX
        const dy = e.screenY - lastY
        if (dx !== 0 || dy !== 0) {
          lastX = e.screenX
          lastY = e.screenY
          window.flypcDesktop?.dragMove(dx, dy)
        }
        return
      }

      if (!pendingHold) return

      const elapsed = Date.now() - holdStartTime
      const distance = Math.hypot(e.screenX - holdStartX, e.screenY - holdStartY)
      if (elapsed >= DRAG_MIN_HOLD_BEFORE_MOVE_MS && distance >= DRAG_MOVE_START_PX) {
        startDrag(e.screenX, e.screenY)
      }
    }

    const onPointerUp = () => {
      const wasPendingHold = pendingHold && !dragging
      const wasOnShim = startedOnShim

      clearHoldTimer()
      pendingHold = false
      startedOnShim = false

      if (dragging) {
        dragging = false
        deactivateDragCapture()
      }

      releaseCapturedPointer()

      if (wasPendingHold && wasOnShim) {
        void window.flypcDesktop?.clickAt(clickClientX, clickClientY)
      }
    }

    shell.addEventListener('pointerdown', onPointerDown)
    shell.addEventListener('pointermove', onPointerMove)
    shell.addEventListener('pointerup', onPointerUp)
    shell.addEventListener('pointercancel', onPointerUp)

    return () => {
      clearHoldTimer()
      pendingHold = false
      dragging = false
      deactivateDragCapture()
      releaseCapturedPointer()
      shell.removeEventListener('pointerdown', onPointerDown)
      shell.removeEventListener('pointermove', onPointerMove)
      shell.removeEventListener('pointerup', onPointerUp)
      shell.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

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
    dispatch(closePanel())
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
    <div className="shell-root" ref={shellRef}>
      <div ref={dragOverlayRef} className="drag-capture-overlay" aria-hidden="true" />
      <Button
        className={`sidebar-handle no-drag ${panelOpen ? 'open' : ''}`}
        onClick={() => dispatch(panelOpen ? closePanel() : togglePanel())}
        aria-label={panelOpen ? 'Hide settings panel' : 'Open settings panel'}
        title={panelOpen ? 'Hide Settings' : 'Open Settings'}
        type="text"
        shape="circle"
        style={{ background: titleBarColor }}
        icon={panelOpen ? <CloseCircleOutlined className="sidebar-handle__icon" /> : <SettingOutlined className="sidebar-handle__icon" />}
      />

      {panelOpen && <div className="sidebar-overlay" onClick={() => dispatch(closePanel())} />}

      <main className="viewport-area">
        {activeEndpoint ? (
          <>
            {!showFlypcOfflineMessage && (
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
                    if (isActiveFlypcEndpoint) {
                      setShowLoadHint(true)
                      return
                    }
                    if (tryFallbackEndpoint()) {
                      return
                    }
                    setShowLoadHint(true)
                  }}
                />
                <div className="iframe-drag-shim" aria-hidden="true" />
              </>
            )}
            {showFlypcOfflineMessage && (
              <div className="flypc-offline-message">
                <div className="flypc-offline-message__card">
                  <p>Flypc is offline.</p>
                  <p>Switch to other endpoints</p>
                </div>
              </div>
            )}
            {showLoadHint && !dismissedHint && !showFlypcOfflineMessage && (
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
                  onClick={() => {
                    dispatch(setActiveEndpoint(entry.url))
                    dispatch(closePanel())
                  }}
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
