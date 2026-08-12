import React from 'react'
import { MailOutlined } from '@ant-design/icons'

export type NotificationItem = {
  id: string
  type: string
  title: string
  message: string
  payload: Record<string, unknown>
  status: 'unread' | 'read' | 'held'
  readAt: string | null
  expiresAt: string | null
  createdAt: string
}

type NotificationPanelProps = {
  authToken: string
  isDashboard: boolean
  compact?: boolean
  iconColor: string
  primaryColor: string
}

const buildAuthHeaders = (authToken: string): Headers => {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' })
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return headers
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  authToken,
  isDashboard,
  compact = false,
  iconColor,
  primaryColor,
}) => {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)

  const loadNotifications = React.useCallback(async (): Promise<void> => {
    if (!authToken) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      const response = await fetch('/user/notifications', { headers: buildAuthHeaders(authToken) })
      const payload = (await response.json()) as {
        ok: boolean
        notifications: NotificationItem[]
        unreadCount: number
      }
      if (!response.ok) {
        return
      }
      setNotifications(payload.notifications ?? [])
      setUnreadCount(payload.unreadCount ?? 0)
    } catch {
      // Ignore transient notification fetch errors.
    }
  }, [authToken])

  React.useEffect(() => {
    void loadNotifications()
    if (!authToken) {
      return undefined
    }

    const timer = window.setInterval(() => {
      void loadNotifications()
    }, 10_000)

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'flypc:notifications-changed') {
        void loadNotifications()
      }
    }
    window.addEventListener('message', onMessage)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('message', onMessage)
    }
  }, [authToken, loadNotifications])

  React.useEffect(() => {
    if (!open) {
      return undefined
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const markRead = async (id: string): Promise<void> => {
    const response = await fetch(`/user/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      headers: buildAuthHeaders(authToken),
    })
    const payload = (await response.json()) as { unreadCount: number; notifications?: NotificationItem[] }
    if (response.ok) {
      setUnreadCount(payload.unreadCount ?? 0)
      await loadNotifications()
    }
  }

  const markHeld = async (id: string): Promise<void> => {
    const response = await fetch(`/user/notifications/${encodeURIComponent(id)}/hold`, {
      method: 'PATCH',
      headers: buildAuthHeaders(authToken),
    })
    const payload = (await response.json()) as { unreadCount: number }
    if (response.ok) {
      setUnreadCount(payload.unreadCount ?? 0)
      await loadNotifications()
    }
  }

  const closePanel = async (): Promise<void> => {
    setOpen(false)
    const response = await fetch('/user/notifications/read-all', {
      method: 'POST',
      headers: buildAuthHeaders(authToken),
    })
    const payload = (await response.json()) as { unreadCount: number; notifications: NotificationItem[] }
    if (response.ok) {
      setUnreadCount(payload.unreadCount ?? 0)
      setNotifications(payload.notifications ?? [])
    }
  }

  if (!authToken || unreadCount === 0) {
    return null
  }

  return (
    <div style={{ position: 'relative', width: compact ? 'auto' : '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        title="Notifications"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: compact ? 'auto' : '100%',
          padding: isDashboard ? '0.45rem 0.65rem' : '0.5rem',
          borderRadius: '6px',
          border: 'none',
          background: open ? 'rgba(148, 163, 184, 0.18)' : 'transparent',
          fontSize: '0.78rem',
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isDashboard ? 'flex-start' : 'center',
          gap: '0.35rem',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: isDashboard ? '0.85rem' : '15px', flexShrink: 0, position: 'relative' }}>
          <MailOutlined />
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-6px',
              minWidth: '14px',
              height: '14px',
              borderRadius: '999px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.58rem',
              lineHeight: '14px',
              textAlign: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount}
          </span>
        </span>
        {isDashboard && <span>Notifications</span>}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 0.35rem)',
            left: compact ? 'auto' : 0,
            right: compact ? 0 : 0,
            width: compact ? '240px' : undefined,
            minWidth: isDashboard ? '240px' : '220px',
            maxHeight: '280px',
            overflowY: 'auto',
            padding: '0.45rem',
            borderRadius: '10px',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            background: 'rgba(255, 255, 255, 0.97)',
            boxShadow: '0 14px 28px rgba(15, 23, 42, 0.18)',
            zIndex: 1200,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <strong style={{ fontSize: '0.78rem', color: '#0f172a' }}>Notifications</strong>
            <button
              type="button"
              onClick={() => void closePanel()}
              style={{
                border: 'none',
                background: 'transparent',
                color: primaryColor,
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          {notifications.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>No notifications.</p>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '0.55rem 0.45rem',
                  borderRadius: '8px',
                  background: item.status === 'unread' ? 'rgba(89, 126, 247, 0.08)' : '#f8fafc',
                  marginBottom: '0.35rem',
                }}
              >
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#0f172a' }}>{item.title}</div>
                {item.message ? (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>{item.message}</div>
                ) : null}
                <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.45rem' }}>
                  {item.status === 'unread' && (
                    <button
                      type="button"
                      onClick={() => void markRead(item.id)}
                      style={{ border: 'none', background: 'transparent', color: primaryColor, fontSize: '0.68rem', cursor: 'pointer' }}
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void markHeld(item.id)}
                    style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '0.68rem', cursor: 'pointer' }}
                  >
                    Hold
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
