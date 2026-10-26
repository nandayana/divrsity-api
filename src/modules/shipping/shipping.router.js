import express from 'express';
import shipping from './shipping.controller.js';
import { adminAuth } from '../../middleware/adminAuth.js'
import { jwtAuth } from '../../middleware/jwtAuth.js'

const router = express.Router();

/* router.get('/province', shipping.getProvince);
router.get('/city/:id', shipping.getCity);
router.get('/district/:id', shipping.getDistrict); */
router.post('/service', shipping.getShippingCost);
router.get('/destination', shipping.getDestination)
router.post('/calculate', shipping.getShippingCost)
router.put('/webhook', shipping.webHook)
router.post('/pickup', jwtAuth, adminAuth, shipping.pickupOrder)
router.get('/download-label/:orderId', jwtAuth, adminAuth, shipping.downloadLabel)
router.get('/history/:courier/:awb', jwtAuth, adminAuth, shipping.getShippingHistory)

export default router