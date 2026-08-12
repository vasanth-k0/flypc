import { Op } from 'sequelize'
import {
  NotificationModel,
  type NotificationStatus,
} from '../db/models/Notification.model.js'

export type NotificationRecord = {
  id: string
  username: string
  type: string
  title: string
  message: string
  payload: Record<string, unknown>
  status: NotificationStatus
  readAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

const READ_TTL_MS = 3 * 60 * 1000

const serialize = (row: NotificationModel): NotificationRecord => ({
  id: row.id,
  username: row.username,
  type: row.type,
  title: row.title,
  message: row.message,
  payload: JSON.parse(row.payload || '{}') as Record<string, unknown>,
  status: row.status,
  readAt: row.readAt ? row.readAt.toISOString() : null,
  expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const activeWhere = (username: string) => ({
  username,
  [Op.or]: [
    { expiresAt: null },
    { expiresAt: { [Op.gt]: new Date() } },
  ],
})

export class NotificationService {
  async purgeExpired(): Promise<number> {
    const deleted = await NotificationModel.destroy({
      where: {
        expiresAt: {
          [Op.lte]: new Date(),
        },
      },
    })
    return deleted
  }

  async create(input: {
    username: string
    type: string
    title: string
    message?: string
    payload?: Record<string, unknown>
    status?: NotificationStatus
  }): Promise<NotificationRecord> {
    const row = await NotificationModel.create({
      username: input.username,
      type: input.type,
      title: input.title,
      message: input.message ?? '',
      payload: JSON.stringify(input.payload ?? {}),
      status: input.status ?? 'unread',
    })
    return serialize(row)
  }

  async update(
    id: string,
    username: string,
    patch: {
      type?: string
      title?: string
      message?: string
      payload?: Record<string, unknown>
      status?: NotificationStatus
    },
  ): Promise<NotificationRecord | null> {
    const row = await NotificationModel.findOne({ where: { id, username } })
    if (!row) {
      return null
    }

    if (patch.type !== undefined) row.type = patch.type
    if (patch.title !== undefined) row.title = patch.title
    if (patch.message !== undefined) row.message = patch.message
    if (patch.payload !== undefined) row.payload = JSON.stringify(patch.payload)
    if (patch.status !== undefined) row.status = patch.status

    await row.save()
    return serialize(row)
  }

  async listForUser(username: string): Promise<NotificationRecord[]> {
    await this.purgeExpired()
    const rows = await NotificationModel.findAll({
      where: activeWhere(username),
      order: [['createdAt', 'DESC']],
    })
    return rows.map(serialize)
  }

  async countUnread(username: string): Promise<number> {
    await this.purgeExpired()
    return NotificationModel.count({
      where: {
        ...activeWhere(username),
        status: 'unread',
      },
    })
  }

  async markRead(id: string, username: string): Promise<NotificationRecord | null> {
    const row = await NotificationModel.findOne({ where: { id, username } })
    if (!row) {
      return null
    }

    row.status = 'read'
    row.readAt = new Date()
    row.expiresAt = new Date(Date.now() + READ_TTL_MS)
    await row.save()
    return serialize(row)
  }

  async markHeld(id: string, username: string): Promise<NotificationRecord | null> {
    const row = await NotificationModel.findOne({ where: { id, username } })
    if (!row) {
      return null
    }

    row.status = 'held'
    row.readAt = null
    row.expiresAt = null
    await row.save()
    return serialize(row)
  }

  async markAllRead(username: string): Promise<number> {
    const rows = await NotificationModel.findAll({
      where: {
        username,
        status: 'unread',
      },
    })

    const expiresAt = new Date(Date.now() + READ_TTL_MS)
    const now = new Date()

    await Promise.all(
      rows.map(async (row) => {
        row.status = 'read'
        row.readAt = now
        row.expiresAt = expiresAt
        await row.save()
      }),
    )

    return rows.length
  }
}

export const notificationService = new NotificationService()

let cleanupTimer: NodeJS.Timeout | null = null

export const startNotificationCleanup = (): void => {
  if (cleanupTimer) {
    return
  }

  cleanupTimer = setInterval(() => {
    void notificationService.purgeExpired()
  }, 60_000)
}
