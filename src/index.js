import dotenv from 'dotenv'
import express from 'express'
import api from './router/index.js'
import cookieParser from 'cookie-parser'

import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(cookieParser())

// Static media
app.use(
  '/media/images',
  express.static(
    path.join(__dirname, '../media/images')
  )
)

// API
app.use('/api', api)

const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server jalan di port ${PORT}`)
})