import React from 'react'
import { Button, Input } from 'antd'
import type { AuthUser } from '../../types/dashboard'

type AccountsViewProps = {
  authUser: AuthUser | null
  accountError: string
  accountMessage: string
  loginUsername: string
  loginPassword: string
  changeNameValue: string
  currentPassword: string
  newPassword: string
  onLoginUsernameChange: (value: string) => void
  onLoginPasswordChange: (value: string) => void
  onChangeNameValueChange: (value: string) => void
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onLoginRequest: () => void
  onChangeName: () => void
  onResetPassword: () => void
  onLogout: () => void
  onOpenMembers: () => void
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  authUser,
  accountError,
  accountMessage,
  loginUsername,
  loginPassword,
  changeNameValue,
  currentPassword,
  newPassword,
  onLoginUsernameChange,
  onLoginPasswordChange,
  onChangeNameValueChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onLoginRequest,
  onChangeName,
  onResetPassword,
  onLogout,
  onOpenMembers,
}) => (
  <>
    <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 500, color: '#0f172a', letterSpacing: '-0.01em' }}>
      Accounts
    </h2>
    <p style={{ margin: '0 0 1.1rem', fontSize: '0.78rem', color: '#64748b' }}>
      Login, reset password, and change your account name.
    </p>

    {accountError ? <div style={{ color: '#b91c1c', marginBottom: '0.75rem', fontSize: '0.78rem' }}>{accountError}</div> : null}
    {accountMessage ? <div style={{ color: '#166534', marginBottom: '0.75rem', fontSize: '0.78rem' }}>{accountMessage}</div> : null}

    {!authUser ? (
      <div style={{ maxWidth: '460px', display: 'grid', gap: '0.7rem' }}>
        <label style={{ fontSize: '0.78rem', color: '#334155' }}>
          Username
          <Input
            value={loginUsername}
            onChange={(event) => onLoginUsernameChange(event.target.value)}
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ fontSize: '0.78rem', color: '#334155' }}>
          Password
          <Input.Password
            value={loginPassword}
            onChange={(event) => onLoginPasswordChange(event.target.value)}
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Button onClick={onLoginRequest} type="primary">
            Login
          </Button>
        </div>
      </div>
    ) : (
      <div style={{ maxWidth: '640px', display: 'grid', gap: '1rem' }}>
        <div style={{ padding: '0.8rem 0.9rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
          Signed in as <strong>{authUser.username}</strong> ({authUser.role})
        </div>

        <div style={{ padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '0.55rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>Name Change</h3>
          <Input
            value={changeNameValue}
            onChange={(event) => onChangeNameValueChange(event.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <Button onClick={onChangeName} type="primary">
            Update Name
          </Button>
        </div>

        <div style={{ padding: '0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '0.55rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a' }}>Password Reset</h3>
          <Input.Password
            placeholder="Current password"
            value={currentPassword}
            onChange={(event) => onCurrentPasswordChange(event.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <Input.Password
            placeholder="New password"
            value={newPassword}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            style={{ width: '100%', padding: '0.55rem 0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <Button onClick={onResetPassword} type="primary">
            Reset Password
          </Button>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {authUser.role === 'Admin' ? (
            <Button
              onClick={onOpenMembers}
              style={{ padding: '0.52rem 0.82rem', borderRadius: '8px', border: '1px solid #94a3b8', background: '#fff', color: '#1e293b', cursor: 'pointer' }}
            >
              Members
            </Button>
          ) : null}
          <Button
            onClick={onLogout}
            danger
            style={{ padding: '0.52rem 0.82rem', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer' }}
          >
            Logout
          </Button>
        </div>
      </div>
    )}
  </>
)
