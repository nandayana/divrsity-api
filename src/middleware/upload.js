import multer from 'multer'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'; 

dotenv.config(); 

const uploadPath = process.env.MEDIA_PATH

// Pastikan directory tersedia
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true
  })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath)
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname)

    const filename = `${Date.now()}-${Math.round(
      Math.random() * 1E9
    )}${extension}`

    cb(null, filename)
  }
})

const fileFilter = (req, file, cb) => {

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ]

  cb(null, true)

  /* if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Invalid image type: ${file.mimetype}`
      )
    )
  } */
}

export const uploadImage = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
})