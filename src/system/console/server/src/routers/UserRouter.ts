import express from 'express'
import {
	changeUserName,
	getAuthenticatedUser,
	getMembers,
	loginUser,
	logoutUser,
	registerUser,
	removeUser,
	resetUserPassword,
} from '../controllers/UserController.js'
import {
	listNotificationsHandler,
	markAllNotificationsReadHandler,
	markNotificationReadHandler,
	holdNotificationHandler,
} from '../controllers/NotificationController.js'
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js'
import { passwordRules, usernameRules, validateRequest } from '../middleware/validation.middleware.js'

const router = express.Router()

router.post('/user/register', requireAuth, requireAdmin, usernameRules, passwordRules, validateRequest, registerUser)
router.post('/user/login', usernameRules, passwordRules, validateRequest, loginUser)
router.post('/user/logout', requireAuth, logoutUser)
router.post('/user/remove', requireAuth, removeUser)
router.get('/user/me', requireAuth, getAuthenticatedUser)
router.post('/user/change-name', requireAuth, changeUserName)
router.post('/user/reset-password', requireAuth, resetUserPassword)
router.get('/user/members', requireAuth, requireAdmin, getMembers)

router.get('/user/notifications', requireAuth, (req, res, next) => {
	void listNotificationsHandler(req, res).catch(next)
})
router.patch('/user/notifications/:id/read', requireAuth, (req, res, next) => {
	void markNotificationReadHandler(req, res).catch(next)
})
router.patch('/user/notifications/:id/hold', requireAuth, (req, res, next) => {
	void holdNotificationHandler(req, res).catch(next)
})
router.post('/user/notifications/read-all', requireAuth, (req, res, next) => {
	void markAllNotificationsReadHandler(req, res).catch(next)
})

export default router
