import express from 'express';
import productImage from './productImage.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.single('image'), jwtAuth, adminAuth, productImage.createProductImage);
router.get('/', productImage.getProductImages);
router.get('/:id', productImage.getImageById);
router.put('/:id', uploadImage.single('image'), jwtAuth, adminAuth, productImage.updateProductImage);
router.delete('/:id', jwtAuth, adminAuth, productImage.deleteProductImage);

export default router