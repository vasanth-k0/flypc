import express from 'express'
import {
	getSystemSettings,
	getSystemTheme,
	updatePreferences,
	updateSystemBlueprint,
	updateSystemSettingCompat,
} from '../controllers/SettingsController.js'
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/system/settings', getSystemSettings)
router.get('/system/theme', getSystemTheme)
router.post('/system/update', updateSystemSettingCompat)
router.post('/settings/preferences', requireAuth, updatePreferences)
router.put('/settings/preferences', requireAuth, updatePreferences)
router.post('/system/blueprint', requireAuth, requireAdmin, updateSystemBlueprint)
router.put('/system/blueprint', requireAuth, requireAdmin, updateSystemBlueprint)

export default router
