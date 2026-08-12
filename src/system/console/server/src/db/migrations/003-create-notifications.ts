import type { QueryInterface } from 'sequelize'
import { DataTypes } from 'sequelize'

export const up = async ({ context }: { context: QueryInterface }): Promise<void> => {
  await context.createTable('Notifications', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '{}',
    },
    status: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'unread',
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  })

  await context.addIndex('Notifications', ['username', 'status'], {
    name: 'notifications_username_status',
  })
  await context.addIndex('Notifications', ['expiresAt'], {
    name: 'notifications_expires_at',
  })
}

export const down = async ({ context }: { context: QueryInterface }): Promise<void> => {
  await context.dropTable('Notifications')
}
