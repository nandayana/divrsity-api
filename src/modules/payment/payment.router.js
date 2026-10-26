import express from 'express';
import payment from './payment.controller.js';
import { uploadImage } from '../../middleware/upload.js';
import { jwtAuth } from '../../middleware/jwtAuth.js'
import { adminAuth } from '../../middleware/adminAuth.js'

const router = express.Router();

router.get('/list', payment.getList);
router.put('/upload-image/:id', uploadImage.single('image'), payment.uploadImage);
router.put('/update-status/:id', jwtAuth, adminAuth, payment.updatePaymentStatus);
router.post('/callback', payment.callbackPayment);
router.post('/payment-check', jwtAuth, adminAuth, payment.paymentCheck);
router.post('/resend-shipping', jwtAuth, adminAuth, payment.resendShipping);

export default router