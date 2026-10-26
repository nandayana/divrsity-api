import express from 'express';
import product from './product.controller.js';
import { uploadImage } from '../../middleware/upload.js';
import categoryRouter from './category/category.router.js'
import productRouter from './product/product.router.js'
import productImageRouter from './productImage/productImage.router.js'
import colorRouter from './color/color.router.js'
import sizeRouter from './size/size.router.js'
import variantRouter from './variant/variant.router.js'

const router = express.Router();

router.use('/category', categoryRouter)
router.use('/product', productRouter)
router.use('/image', productImageRouter)
router.use('/color', colorRouter)
router.use('/size', sizeRouter)
router.use('/variant', variantRouter)

router.get('/display-categories', product.getCategories)
router.get('/display-products', product.getProducts)

export default router