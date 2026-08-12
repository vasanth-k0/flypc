import React from 'react'

type MonitorViewProps = {
  isDashboard: boolean
  primaryColor: string
}

export const MonitorView: React.FC<MonitorViewProps> = ({ isDashboard, primaryColor }) => (
  <>
    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
      System Health Overview
    </h2>
    <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: '#64748b' }}>
      Monitoring physical node capacity and containers.
    </p>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      {[
        { label: 'CPU Usage', val: '24%', sub: '2.4 GHz Avg' },
        { label: 'Memory', val: '4.8 GB / 8 GB', sub: '60% Allocated' },
        { label: 'Storage', val: '12.4 GB Free', sub: 'SSD Pool' },
        { label: 'Isolated Pods', val: '4 Active', sub: 'Sandboxed' },
      ].map((metric) => (
        <div
          key={metric.label}
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: isDashboard ? '#f8fafc' : 'rgba(0, 0, 0, 0.03)',
            border: isDashboard ? '1px solid #e2e8f0' : '1px solid rgba(0, 0, 0, 0.06)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4)',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {metric.label}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', lineHeight: 1.2 }}>
            {metric.val}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {metric.sub}
          </div>
        </div>
      ))}
    </div>

    <div
      style={{
        padding: '1rem',
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)`,
        border: `1px solid ${primaryColor}30`,
        color: '#475569',
        fontSize: '0.75rem',
        lineHeight: '1.5',
      }}
    >
      <span style={{ fontWeight: 500 }}>Pro-Tip:</span> Switch to <span style={{ fontWeight: 500 }}>Settings</span> to adjust layouts, color schemes, and observe changes in realtime.
    </div>
  </>
)
