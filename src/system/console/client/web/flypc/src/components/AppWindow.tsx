import React from 'react'
import { AppControlPane } from './AppControlPane'
import { AppBootChecklist } from './AppBootChecklist'
import { bindIframeContextMenuBridge } from '../utils/iframeContextMenuBridge'
import { useAppBoot } from '../hooks/useAppBoot'

import type { ControlsSide, TitleBarStyle } from '../utils/windowLayout'

type AppWindowProps = {
  appKey: string
  appName: string
  controlsOpen: boolean
  controlsSide: ControlsSide
  titleBarStyle: TitleBarStyle
  controlsWidth: string
  titleBarHeight: string
  transparentControls: boolean
  showControlsBorder: boolean
  primaryColor: string
  partialChrome?: React.ReactNode
}

const COLLAPSED_CONTROLS_STRIP = '2.5rem'

export const AppWindow: React.FC<AppWindowProps> = ({
  appKey,
  appName,
  controlsOpen,
  controlsSide,
  titleBarStyle,
  controlsWidth,
  titleBarHeight,
  transparentControls,
  showControlsBorder,
  primaryColor,
  partialChrome,
}) => {
  const appRef = React.useRef<{ pause: () => Promise<unknown> } | null>(null)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const { loading, error, runtime, steps, failed } = useAppBoot(appKey)

  React.useEffect(() => {
    appRef.current = {
      pause: async () => {
        const { App } = await import('../apps/App')
        return new App(appKey).pause()
      },
    }

    return () => {
      void appRef.current?.pause().catch(() => {
        // Ignore pause errors during window teardown.
      })
      appRef.current = null
    }
  }, [appKey])

  React.useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return undefined
    }

    return bindIframeContextMenuBridge(iframe)
  }, [runtime?.url])

  const isPartialTitle = titleBarStyle === 'partial'
  const isRightPanel = controlsSide === 'right'
  const showCollapsedStrip = isPartialTitle && !controlsOpen
  const activePanelWidth = controlsOpen ? controlsWidth : COLLAPSED_CONTROLS_STRIP

  const partialTitlePadding = isPartialTitle && !partialChrome ? titleBarHeight : '0'
  const stripBackground = showCollapsedStrip ? primaryColor : transparentControls ? 'transparent' : '#ffffff'

  const useFlexLayout = isPartialTitle
  let panelWidth = controlsWidth
  let panelTransform = 'translateX(0)'
  let panelFlexBasis = activePanelWidth
  let panelOffScreen = false

  if (isPartialTitle) {
    panelWidth = activePanelWidth
    panelFlexBasis = activePanelWidth
    panelTransform = 'translateX(0)'
  } else if (isRightPanel) {
    panelOffScreen = !controlsOpen
    panelTransform = controlsOpen ? 'translateX(0)' : 'translateX(100%)'
  } else {
    panelOffScreen = !controlsOpen
    panelTransform = controlsOpen ? 'translateX(0)' : 'translateX(-100%)'
  }

  const appContent = loading && steps.length > 0 ? (
    <AppBootChecklist appName={appName} steps={steps} failed={failed} />
  ) : loading ? (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '240px',
        color: '#64748b',
        fontSize: '0.92rem',
      }}
    >
      Starting {appName}...
    </div>
  ) : error ? (
    <div
      style={{
        padding: '1rem',
        color: '#b42318',
        background: '#fef3f2',
        border: '1px solid #fecdca',
        borderRadius: '10px',
        fontSize: '0.92rem',
        lineHeight: 1.5,
      }}
    >
      Unable to start {appName}. {error}
    </div>
  ) : !runtime?.url ? (
    <div
      style={{
        padding: '1rem',
        color: '#334155',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '0.92rem',
        lineHeight: 1.6,
      }}
    >
      <strong>{appName}</strong> is running
      {runtime?.status ? ` (${runtime.status})` : ''}.
      {runtime?.detail ? ` ${runtime.detail}` : ' No web URL is exposed for this service.'}
      {runtime?.ports && Object.keys(runtime.ports).length > 0 && (
        <div style={{ marginTop: '0.5rem', color: '#64748b' }}>
          Ports:{' '}
          {Object.entries(runtime.ports)
            .map(([name, port]) => `${name}:${port}`)
            .join(', ')}
        </div>
      )}
    </div>
  ) : (
    <iframe
      ref={iframeRef}
      title={appName}
      src={runtime.url}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '420px',
        border: 'none',
        borderRadius: '0',
        background: '#ffffff',
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      allow="clipboard-read; clipboard-write"
    />
  )

  const asideStyle: React.CSSProperties = {
    flex: useFlexLayout ? `0 0 ${panelFlexBasis}` : undefined,
    width: panelWidth,
    minWidth: useFlexLayout ? panelFlexBasis : undefined,
    maxWidth: useFlexLayout ? panelFlexBasis : undefined,
    display: useFlexLayout ? 'flex' : undefined,
    flexDirection: useFlexLayout ? 'column' : undefined,
    alignItems: useFlexLayout ? 'stretch' : undefined,
    transform: panelTransform,
    transition: 'width 260ms ease, min-width 260ms ease, max-width 260ms ease, flex-basis 260ms ease, transform 260ms ease',
    background: controlsOpen
      ? transparentControls
        ? 'transparent'
        : '#ffffff'
      : stripBackground,
    backdropFilter: transparentControls && controlsOpen ? 'none' : controlsOpen ? 'blur(18px)' : 'none',
    borderLeft: showControlsBorder && controlsSide === 'right' ? '1px solid rgba(15, 23, 42, 0.12)' : 'none',
    borderRight: showControlsBorder && controlsSide === 'left' ? '1px solid rgba(15, 23, 42, 0.12)' : 'none',
    boxSizing: 'border-box',
    paddingTop: partialTitlePadding,
    pointerEvents: controlsOpen || showCollapsedStrip ? 'auto' : 'none',
    overflow: 'hidden',
    order: isRightPanel ? 2 : 0,
  }

  const contentStyle: React.CSSProperties = {
    flex: useFlexLayout ? '1 1 auto' : undefined,
    minWidth: useFlexLayout ? 0 : undefined,
    order: isRightPanel ? 0 : 1,
  }

  if (useFlexLayout) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <aside id="controls" aria-hidden={!controlsOpen && !showCollapsedStrip} style={asideStyle}>
          {partialChrome}
          {controlsOpen ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <AppControlPane appKey={appKey} appName={appName} />
            </div>
          ) : null}
        </aside>
        <div id="content" style={contentStyle}>
          {appContent}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <aside
        id="controls"
        aria-hidden={!controlsOpen && !panelOffScreen}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [controlsSide]: 0,
          ...asideStyle,
          zIndex: 3,
        }}
      >
        {controlsOpen ? <AppControlPane appKey={appKey} appName={appName} /> : null}
      </aside>
      <div
        id="content"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: isRightPanel ? '0' : controlsOpen ? controlsWidth : '0',
          width: isRightPanel
            ? controlsOpen
              ? `calc(100% - ${controlsWidth})`
              : '100%'
            : controlsOpen
              ? `calc(100% - ${controlsWidth})`
              : '100%',
          transition: 'left 260ms ease, width 260ms ease',
          zIndex: 1,
        }}
      >
        {appContent}
      </div>
    </div>
  )
}
