import express from 'express';
import variant from './variant.controller.js';
import { uploadImage } from '../../../middleware/upload.js';
import { adminAuth } from '../../../middleware/adminAuth.js'
import { jwtAuth } from '../../../middleware/jwtAuth.js'

const router = express.Router();

router.post('/', uploadImage.none(), jwtAuth, adminAuth, variant.createVariant);
router.get('/', variant.getVariants);
router.get('/:id', variant.getVariantById);
router.put('/:id', uploadImage.none(), jwtAuth, adminAuth, variant.updateVariant);
router.delete('/:id', jwtAuth, adminAuth, variant.deleteVariant);

export default router