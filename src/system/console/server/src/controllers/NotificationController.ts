import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js'
import { notificationService } from '../services/NotificationService.js'

const getUsername = (req: Request): string | null => {
  const typedReq = req as AuthenticatedRequest
  const username = typedReq.authUser?.username
  if (!username || username === 'guest') {
    return null
  }
  return username
}

export const listNotificationsHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const notifications = await notificationService.listForUser(username)
    const unreadCount = await notificationService.countUnread(username)
    res.json({ ok: true, notifications, unreadCount })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to load notifications',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const markNotificationReadHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  const id = String(req.params.id ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const notification = await notificationService.markRead(id, username)
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' })
      return
    }

    const unreadCount = await notificationService.countUnread(username)
    res.json({ ok: true, notification, unreadCount })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to update notification',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const holdNotificationHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  const id = String(req.params.id ?? '')

  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const notification = await notificationService.markHeld(id, username)
    if (!notification) {
      res.status(404).json({ error: 'Notification not found' })
      return
    }

    const unreadCount = await notificationService.countUnread(username)
    res.json({ ok: true, notification, unreadCount })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to hold notification',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

export const markAllNotificationsReadHandler = async (req: Request, res: Response): Promise<void> => {
  const username = getUsername(req)
  if (!username) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    await notificationService.markAllRead(username)
    const notifications = await notificationService.listForUser(username)
    const unreadCount = await notificationService.countUnread(username)
    res.json({ ok: true, notifications, unreadCount })
  } catch (error) {
    res.status(500).json({
      error: 'Unable to mark notifications read',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
