import React from 'react'
import type { MemberSummary } from '../../types/dashboard'
import { formatBytes } from '../../utils/formatBytes'

type MembersViewProps = {
  members: MemberSummary[]
  membersError: string
}

export const MembersView: React.FC<MembersViewProps> = ({ members, membersError }) => (
  <>
    <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
      Members
    </h2>
    <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: '#64748b' }}>
      Admin view of registered users and app/storage usage.
    </p>

    {membersError ? <div style={{ marginBottom: '0.7rem', color: '#b91c1c', fontSize: '0.78rem' }}>{membersError}</div> : null}

    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px', fontSize: '0.78rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Username</th>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Role</th>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Created</th>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Apps</th>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Storage</th>
            <th style={{ padding: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>Usage % (100 MB)</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.username}</td>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{member.role}</td>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{new Date(member.createdAt).toLocaleString()}</td>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{(member.apps ?? []).length ? (member.apps ?? []).join(', ') : '-'}</td>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{formatBytes(member.totalStorageBytes ?? 0)}</td>
              <td style={{ padding: '0.6rem 0.65rem', borderBottom: '1px solid #f1f5f9' }}>{(member.usagePercent ?? 0).toFixed(2)}%</td>
            </tr>
          ))}
          {members.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '0.9rem', textAlign: 'center', color: '#64748b' }}>
                No members available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  </>
)
