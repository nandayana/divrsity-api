// middleware/upload.ts (atau upload.js)
import multer from 'multer'

// Simpan file di memory buffer agar bisa langsung dibaca oleh SheetJS tanpa disimpan ke disk
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ]

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('File harus berformat Excel (.xlsx atau .xls)'), false)
  }
}

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Batas ukuran file 5MB
})