import React from 'react'
import {
  AppstoreOutlined,
  EditFilled,
  CodeFilled,
  ThunderboltFilled,
  FileTextFilled,
  DatabaseFilled,
  InfoCircleFilled,
  GlobalOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { AppEntry, WindowId } from '../types/dashboard'

export const APP_ICON_COMPONENTS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  EditFilled,
  CodeFilled,
  ThunderboltFilled,
  DatabaseFilled,
  FileTextFilled,
  InfoCircleFilled,
  AppstoreOutlined,
  GlobalOutlined,
}

export const renderAppIcon = (iconName: string, color?: string): React.ReactNode => {
  const Icon = APP_ICON_COMPONENTS[iconName] ?? AppstoreOutlined
  return <Icon style={color ? { color } : undefined} />
}

export const withMenuIconColor = (icon: React.ReactNode, color: string): React.ReactNode => (
  <span style={{ color, display: 'inline-flex', lineHeight: 0, alignItems: 'center' }}>
    {icon}
  </span>
)

export type MenuItem = {
  key: string
  label: string
  icon: React.ReactNode
}

export const buildAccountSubmenuItems = (isAdmin: boolean): Array<{ key: WindowId; label: string; icon: React.ReactNode }> => [
  { key: 'accounts', label: 'Accounts', icon: <UserOutlined /> },
  ...(isAdmin ? [{ key: 'members' as WindowId, label: 'Members', icon: <UserOutlined /> }] : []),
]

export const buildVisibleMenuItems = (
  baseMenuItems: MenuItem[],
  openApps: AppEntry[],
  accountHubMenuItem: MenuItem,
): MenuItem[] => [
  baseMenuItems[0],
  baseMenuItems[1],
  ...openApps.map((app) => ({ key: `app:${app.key}`, label: app.name, icon: renderAppIcon(app.icon) })),
  ...baseMenuItems.slice(2, 4),
  accountHubMenuItem,
  ...baseMenuItems.slice(4),
]
