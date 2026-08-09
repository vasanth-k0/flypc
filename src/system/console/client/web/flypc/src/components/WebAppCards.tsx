import React from 'react'
import { Button } from 'antd'
import { RightCircleOutlined } from '@ant-design/icons'

type WebAppCard = {
  key: string
  name: string
  description?: string
  icon: React.ReactNode
  onOpen: () => void
}

type WebAppCardsProps = {
  apps: WebAppCard[]
  isLandscape: boolean
}

export const WebAppCards: React.FC<WebAppCardsProps> = ({ apps, isLandscape }) => (
  <div
    style={{
      display: 'flex',
      flexWrap: isLandscape ? 'nowrap' : 'wrap',
      alignContent: 'flex-start',
      gap: isLandscape ? '1.25rem' : '1rem',
      overflowX: isLandscape ? 'auto' : 'hidden',
      overflowY: isLandscape ? 'hidden' : 'auto',
      maxHeight: '100%',
      paddingBottom: '1rem',
    }}
  >
    {apps.map((app) => (
      <Button
        key={app.key}
        onClick={app.onOpen}
        type="text"
        style={{
          height: isLandscape ? 'clamp(9rem, 16.5vw, 15rem)' : 'clamp(11rem, 40vw, 12rem)',
          flex: isLandscape ? '0 0 13.5%' : '0 0 calc((100% - 2rem) / 3)',
          boxSizing: 'border-box',
          padding: isLandscape ? '1.25rem' : '0.875rem',
          border: 'none',
          borderRadius: '0.55rem',
          color: '#ffffff',
          background: '#ffffff0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: '0.35rem',
          textAlign: 'left',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <span style={{ fontSize: '1.5rem', opacity: 0.82, flexShrink: 0 }}>{app.icon}</span>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, marginTop: isLandscape ? '1.75rem' : '0.4rem' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 500 }}>{app.name}</span>
          <span
            title={app.description}
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-wrap', fontSize: '0.65rem', opacity: 0.72, height: '3rem' }}
          >
            {app.description ?? 'No description available.'}
          </span>
        </div>
        <RightCircleOutlined style={{ marginTop: 'auto', fontSize: '1.16rem', alignSelf: 'flex-end', flexShrink: 0 }} />
      </Button>
    ))}
  </div>
)
