import React from 'react'
import { App, type AppRuntime } from '../apps/App'

type AppWindowProps = {
  appKey: string
  appName: string
  controlsOpen: boolean
  controlsSide: 'left' | 'right'
  controlsWidth: string
  titleBarHeight: string
  transparentControls: boolean
  showControlsBorder: boolean
}

const AppControls: React.FC<{ appKey: string; appName: string }> = ({ appKey, appName }) => {
  const [about, setAbout] = React.useState('')

  React.useEffect(() => {
    let cancelled = false

    void fetch(`/apps/${encodeURIComponent(appKey)}/about`, {
      headers: (() => {
        const headers = new Headers()
        const authToken = window.localStorage.getItem('flypc-auth-token')
        if (authToken) {
          headers.set('Authorization', `Bearer ${authToken}`)
        }
        return headers
      })(),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Controls are unavailable.')
        }
        return response.text()
      })
      .then((content) => {
        if (!cancelled) {
          setAbout(content)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setAbout(loadError instanceof Error ? loadError.message : 'Controls are unavailable.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [appKey])

  return (
    <section style={{ height: '100%', boxSizing: 'border-box', overflowY: 'auto', padding: '1rem', color: '#505052', fontSize: '0.82rem', lineHeight: 1.45 }}>
      {about.split('\n').map((line, index) => {
        if (line.startsWith('# ')) {
          return <h2 key={index} style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', color: '#0f172a' }}>{line.slice(2)}</h2>
        }
        if (line.startsWith('- ')) {
          return <div key={index}>• {line.slice(2)}</div>
        }
        return line ? <p key={index} style={{ margin: '0 0 0.7rem' }}>{line}</p> : <div key={index} style={{ height: '0.35rem' }} />
      })}
      {!about && <span>Loading {appName} controls…</span>}
    </section>
  )
}

export const AppWindow: React.FC<AppWindowProps> = ({
  appKey,
  appName,
  controlsOpen,
  controlsSide,
  controlsWidth,
  titleBarHeight,
  transparentControls,
  showControlsBorder,
}) => {
  const appRef = React.useRef<App | null>(null)
  const [runtime, setRuntime] = React.useState<AppRuntime | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const app = new App(appKey)
    appRef.current = app
    let cancelled = false

    const boot = async () => {
      setLoading(true)
      setError(null)

      try {
        const nextRuntime = await app.start()
        if (!cancelled) {
          setRuntime(nextRuntime)
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : String(bootError))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
      void app.stop().catch(() => {
        // Ignore stop errors during window teardown.
      })
      appRef.current = null
    }
  }, [appKey])

  const collapsedControlsWidth = '2.5rem'
  const rightControlsWidth = controlsOpen ? controlsWidth : collapsedControlsWidth
  const controlsOffset = controlsSide === 'left' ? '-100%' : '100%'
  const appOffset = controlsSide === 'left' ? controlsWidth : '0'
  const appWidth = controlsSide === 'right'
    ? controlsOpen ? `calc(100% - ${controlsWidth})` : 'calc(100% - 2.5rem)'
    : '100%'
  const appContent = loading ? (
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div 
        id="content"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: appWidth,
          transform: controlsOpen ? `translateX(${appOffset})` : 'translateX(0)',
          transition: 'width 260ms ease, transform 260ms ease',
        }}
      >
        {appContent}
      </div>
      <aside 
        id="controls"
        aria-hidden={!controlsOpen}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [controlsSide]: 0,
          width: controlsSide === 'right' ? rightControlsWidth : controlsWidth,
          transform: controlsSide === 'right' || controlsOpen ? 'translateX(0)' : `translateX(${controlsOffset})`,
          transition: 'width 260ms ease, transform 260ms ease',
          background: transparentControls ? 'transparent' : '#ffffff',
          backdropFilter: transparentControls ? 'none' : 'blur(18px)',
          borderLeft: showControlsBorder && controlsSide === 'right' ? '1px solid rgba(15, 23, 42, 0.12)' : 'none',
          borderRight: showControlsBorder && controlsSide === 'left' ? '1px solid rgba(15, 23, 42, 0.12)' : 'none',
          boxSizing: 'border-box',
          paddingTop: controlsSide === 'right' && controlsOpen ? titleBarHeight : '0',
          pointerEvents: controlsOpen ? 'auto' : 'none',
          zIndex: 2,
        }}
      >
        {controlsOpen && <AppControls appKey={appKey} appName={appName} />}
      </aside>
    </div>
  )
}
