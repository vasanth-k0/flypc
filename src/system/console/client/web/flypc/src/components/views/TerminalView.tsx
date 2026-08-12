import React from 'react'

type TerminalViewProps = {
  activeTheme: string
}

export const TerminalView: React.FC<TerminalViewProps> = ({ activeTheme }) => (
  <>
    <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
      Container Shell
    </h2>
    <div
      style={{
        background: '#090d16',
        borderRadius: '10px',
        padding: '1.25rem',
        fontFamily: 'var(--mono)',
        fontSize: '0.9rem',
        color: '#4af626',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        border: '1px solid #1e293b',
        height: '240px',
        overflow: 'hidden',
      }}
    >
      <div style={{ color: '#888', marginBottom: '0.5rem' }}>FlyPC Container OS v1.0.0 (x86_64-pc-linux)</div>
      <div>$ flypc list-pods</div>
      <div style={{ color: '#fff', margin: '0.2rem 0 0.5rem' }}>
        pod-0 (Notes)           - RUNNING (pid: 140)
        <br />
        pod-1 (Coderun-Lite)    - RUNNING (pid: 145)
        <br />
        pod-2 (System-Monitor)  - RUNNING (pid: 152)
      </div>
      <div>$ echo &quot;Theme active: {activeTheme}&quot;</div>
      <div style={{ color: '#fff', margin: '0.25rem 0' }}>Theme active: {activeTheme}</div>
      <div
        style={{
          display: 'inline-block',
          width: '8px',
          height: '15px',
          background: '#4af626',
          verticalAlign: 'middle',
          animation: 'pulse 1s infinite',
        }}
      />
    </div>
  </>
)
