import express from 'express';
import cart from './cart.controller.js';
import { uploadImage } from '../../middleware/upload.js';
import { jwtAuth } from '../../middleware/jwtAuth.js'
import { jwtOptional } from '../../middleware/jwtOptional.js'

const router = express.Router();

router.get('/', jwtAuth, cart.getCart);
router.post('/item', jwtAuth, uploadImage.none(), cart.addCartItem);
router.put('/item/:variantId', uploadImage.none(), jwtOptional, cart.updateCartItem);
router.delete('/item/:variantId', jwtOptional, cart.deleteCartItem);
router.delete('/', cart.deleteCart);

export default router