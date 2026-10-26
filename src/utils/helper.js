import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function deleteFile(filePath, isLocalPath = false) {
  if (!filePath) return;
  const fullPath = isLocalPath ? filePath : path.join(__dirname, '../..', filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

export function handleError(res, error, reqFile = null) {
  if (reqFile && reqFile.path) this.deleteFile(reqFile.path, true);

  console.error("Error Detail: ", error);
  let statusCode = typeof error.code === 'number' ? error.code : 500;
  let message = error.message || "Internal Server Error";

  if (error.code === '23503') {
    statusCode = 400;
    message = "Gagal memproses! Data ini masih terikat dengan relasi data aktif lainnya.";
  }

  return res.status(statusCode).json({ status: false, message });
}

export function isValidUuid(id) {
  console.log('ID = ', id)
  return id && uuidRegex.test(id);
}