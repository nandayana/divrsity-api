import express from 'express';
import order from './order.controller.js';
import { jwtAuth } from '../../middleware/jwtAuth.js';
import { adminAuth } from '../../middleware/adminAuth.js'
import { getOrderReport, getShippingReport } from './reportOrder.controller.js';
import { uploadExcel } from '../../middleware/uploadXlsx.js';
import { importAwbFromExcel } from './uploadFile.controller.js';

const router = express.Router();

router.post('/create', jwtAuth, order.createOrder);
router.get('/', jwtAuth, order.getOrder);
router.get('/item/:id', jwtAuth, order.getOrderById);
router.get('/done-order/:orderNumber', jwtAuth, adminAuth, order.doneOrder);
router.get('/list', jwtAuth, adminAuth, order.getOrderList);
router.get('/report', jwtAuth, adminAuth, getOrderReport);
router.get('/shipping', jwtAuth, adminAuth, getShippingReport);
router.put('/shipping/:orderNumber', jwtAuth, adminAuth, order.updateAwb);
router.post('/upload-shipping', uploadExcel.single('file'), jwtAuth, adminAuth, importAwbFromExcel)
/* router.put('/:id', jwtAuth, order.updateOrder);
router.delete('/:id', jwtAuth, order.deleteOrder); */

export default router