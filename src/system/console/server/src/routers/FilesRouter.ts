import express from 'express'
import { resolveAppUser } from '../middleware/appAccess.middleware.js'
import {
  copyFilesHandler,
  createDirectoryHandler,
  deleteFilesHandler,
  listFileRootsHandler,
  listFilesHandler,
  listTreeHandler,
  moveFilesHandler,
  renameFileHandler,
  searchFilesHandler,
  uploadFilesHandler,
} from '../controllers/FileController.js'

const router = express.Router()

router.get('/files/roots', resolveAppUser, listFileRootsHandler)
router.get('/files/list', resolveAppUser, listFilesHandler)
router.get('/files/tree', resolveAppUser, listTreeHandler)
router.get('/files/search', resolveAppUser, searchFilesHandler)
router.post('/files/mkdir', resolveAppUser, createDirectoryHandler)
router.post('/files/upload', resolveAppUser, uploadFilesHandler)
router.post('/files/copy', resolveAppUser, copyFilesHandler)
router.patch('/files/rename', resolveAppUser, renameFileHandler)
router.delete('/files', resolveAppUser, deleteFilesHandler)
router.patch('/files/move', resolveAppUser, moveFilesHandler)

export default router
