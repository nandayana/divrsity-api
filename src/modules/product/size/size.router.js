import express from 'express';
import size from './size.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.none(), jwtAuth, adminAuth, size.createSize);
router.get('/', size.getSizes);
router.get('/:id', size.getSizeById);
router.put('/:id', uploadImage.none(), jwtAuth, adminAuth, size.updateSize);
router.delete('/:id', jwtAuth, adminAuth, size.deleteSize);

export default router