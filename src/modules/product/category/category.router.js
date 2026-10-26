import express from 'express';
import category from './category.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.single('image'), jwtAuth, adminAuth, category.createCategory);
router.get('/', category.getCategories);
router.get('/:id', category.getCategoryById);
router.put('/:id', uploadImage.single('image'), jwtAuth, adminAuth, category.updateCategory);
router.delete('/:id', jwtAuth, adminAuth, category.deleteCategory);
router.post('/delete', uploadImage.single('image'), jwtAuth, adminAuth, category.deleteManyCategory);

export default router