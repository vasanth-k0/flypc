import { DataTypes, Model, Sequelize } from 'sequelize'

export type NotificationStatus = 'unread' | 'read' | 'held'

export interface NotificationAttributes {
  id: string
  username: string
  type: string
  title: string
  message: string
  payload: string
  status: NotificationStatus
  readAt: Date | null
  expiresAt: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface NotificationCreationAttributes {
  username: string
  type: string
  title: string
  message?: string
  payload?: string
  status?: NotificationStatus
}

export class NotificationModel
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare id: string
  declare username: string
  declare type: string
  declare title: string
  declare message: string
  declare payload: string
  declare status: NotificationStatus
  declare readAt: Date | null
  declare expiresAt: Date | null
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export const initNotificationModel = (sequelize: Sequelize): typeof NotificationModel => {
  NotificationModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'Notifications',
    },
  )

  return NotificationModel
}
