import express from 'express';
import productRouter from '../modules/product/product.router.js'
import shippingRouter from '../modules/shipping/shipping.router.js'
import paymentRouter from '../modules/payment/payment.router.js'
import cartRouter from '../modules/cart/cart.router.js'
import orderRouter from '../modules/order/order.router.js'
import authRouter from '../modules/auth/auth.router.js'

const router = express.Router();

router.use('/product', productRouter)
router.use('/shipping', shippingRouter)
router.use('/payment', paymentRouter)
router.use('/cart', cartRouter)
router.use('/order', orderRouter)
router.use('/auth', authRouter)

router.get('/health', (req, res) => {
  res.json({
    status: 'ok'
  })
})

export default router