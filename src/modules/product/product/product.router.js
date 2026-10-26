import express from 'express';
import product from './product.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.none(), jwtAuth, adminAuth, product.createProduct);
router.get('/', product.getProducts);
router.get('/active', product.getActiveProducts);
router.get('/:id', product.getProductById);
router.put('/:id', uploadImage.none(), jwtAuth, adminAuth, product.updateProduct);
router.delete('/:id', jwtAuth, adminAuth, product.deleteProduct);
router.post('/delete', uploadImage.single('image'), jwtAuth, adminAuth, product.deleteManyProduct);

export default router