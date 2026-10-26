import * as XLSX from 'xlsx'
import { db } from '../../db/index.js'
import { orders } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm'

export const importAwbFromExcel = async (req, res) => {
  try {
    // 1. Validasi keberadaan file dari Multer
    if (!req.file) {
      return res.status(400).json({ message: 'Harap unggah file Excel' })
    }

    // 2. Baca file Excel dari buffer Multer
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // 3. Konversi sheet ke array object JavaScript
    const rows = XLSX.utils.sheet_to_json(worksheet)

    if (rows.length === 0) {
      return res.status(400).json({ message: 'File Excel kosong' })
    }

    let updatedCount = 0
    let skippedCount = 0

    // 4. Looping setiap baris data dan update ke database
    for (const row of rows) {
      const orderNumber = row.orderNumber ? String(row.orderNumber).trim() : null
      const shippingNumber = row.awbNumber ? String(row.awbNumber).trim() : null

      // Lewati jika orderNumber atau awbNumber kosong
      if (!orderNumber || !shippingNumber) {
        skippedCount++
        continue
      }

      // Update kolom shippingNumber berdasarkan orderNumber
      const result = await db
        .update(orders)
        .set({
          shippingNumber: shippingNumber,
          updatedAt: new Date()
        })
        .where(eq(orders.orderNumber, orderNumber))
        .returning({ updatedId: orders.id })

      if (result.length > 0) {
        updatedCount++
      } else {
        skippedCount++
      }
    }

    // 5. Kirim respon hasil pemrosesan
    return res.status(200).json({
      message: 'Proses update resi selesai',
      totalRowsInExcel: rows.length,
      successfullyUpdated: updatedCount,
      skippedOrNotFound: skippedCount
    })

  } catch (error) {
    console.error('Error memproses update AWB Excel:', error)
    return res.status(500).json({
      message: 'Gagal memperbarui nomor resi dari Excel',
      error: error.message
    })
  }
}