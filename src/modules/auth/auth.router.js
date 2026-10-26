import express from 'express'
import { googleLogin, getProfile, refreshAccessToken, register, login } from './auth.controller.js'
import { jwtAuth } from '../../middleware/jwtAuth.js'

const router = express.Router()

router.post('/google',googleLogin)
router.get('/profile', jwtAuth, getProfile)
router.post('/refresh', refreshAccessToken)
/* router.post('/register', register) */
router.post('/login', login)

export default router