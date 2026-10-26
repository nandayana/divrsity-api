import express from 'express';
import color from './color.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.single('image'), jwtAuth, adminAuth, color.createColor);
router.get('/', color.getColors);
router.get('/:id', color.getColorById);
router.put('/:id', uploadImage.single('image'), jwtAuth, adminAuth, color.updateColor);
router.delete('/:id', jwtAuth, adminAuth, color.deleteColor);

export default router