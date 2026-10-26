import axios from "axios";
import { db } from "../../db/index.js";
import { shipping, orders, auth, orderAddress, orderShipping } from "../../db/schema/index.js";
import { sendShippingEmail, deliveredShippingEmail } from "../../services/email.service.js";
import { eq } from "drizzle-orm";

class Shipping {
  async getDestination(req, res) {
    try {
      const query = req.query

      const options = {
        method: 'GET',
        url: `${process.env.RAJAONGKIR_SHIPPING_URL}/tariff/api/v1/destination/search?keyword=${query.search}`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_SHIPPING_API_KEY,
          'Content-Type': 'application/json'
        }
      }

      const response = await axios.request(options)

      if (response && response.data.meta.code === 200) {
        res.json({
          results: response.data.data
        })
      } else {
        throw {
          code: 400,
          message: "Request invalid"
        }
      }
    } catch (error) {
      return res.status(error.status || 500).json({
        status: false,
        message: error.message
      })
    }
  }

  async getShippingCost(req, res) {
    try {
      const body = req.body

      console.log('WEIGTH = ', body)

      const options = {
        method: 'GET',
        url: `${process.env.RAJAONGKIR_SHIPPING_URL}/tariff/api/v1/calculate?shipper_destination_id=${process.env.RAJAONGKIR_SHIPPING_ID}&receiver_destination_id=${body.id}&weight=${body.weight}&item_value=${body.price}&cod=no&origin_pin_point=0&destination_pin_point=0`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_SHIPPING_API_KEY,
          'Content-Type': 'application/json'
        }
      }

      const response = await axios.request(options)

      const dataResults = await response.data.data.calculate_reguler.filter(item =>  ['JNE'].includes(item.shipping_name))

      if (response && response.data.meta.code === 200) {
        res.json({
          results: {
            calculate_reguler: dataResults
          }
        })
      } else {
        throw {
          code: 400,
          message: "Request invalid"
        }
      }
    } catch (error) {
      return res.status(error.status || 500).json({
        status: false,
        message: error.message
      })
    }
  }

  async webHook(req, res) {
    try {
      const body = req.body

      console.log('WEBHOOK SHIPPING = ', body)

      const { order_no, cnote, status } = body

      if (!order_no) {
        return res.status(400).json({
          status: false,
          message: 'order_no is required'
        })
      }

      console.log('ORDER NO = ', order_no)

      // 1. Cari data shipping sebelum update
      const [existingShipping] = await db
        .select()
        .from(shipping)
        .where(eq(shipping.shippingNo, order_no))
        .limit(1)

      console.log('EXISTING SHIPPING = ', existingShipping)
      
      if (!existingShipping) {
        return res.status(404).json({
          status: false,
          message: 'Shipping data not found'
        })
      }

      // 2. Update status shipping dan AWB
      console.log('CNOTE = ', cnote)
      const [updatedShipping] = await db
        .update(shipping)
        .set({
          awb: cnote,
          status,
          updatedAt: new Date()
        })
        .where(eq(shipping.shippingNo, order_no))
        .returning()

      console.log('UPDATE SHIPPING = ', updatedShipping)
      console.log('STATUS = ', status)
      console.log('EXISTING STATUS = ', existingShipping.status)

      // 3. Kirim email hanya saat status berubah menjadi sent
      if (status === 'Sent' && existingShipping.status !== 'Sent') {
        console.log('INI SUDAH SENT')
        try {
          // Ambil data order, email customer, dan alamat penerima
          const [orderData] = await db
            .select({
              email: auth.email,
              orderNumber: orders.orderNumber,
              recipientName: orderAddress.recipientName,
              shipping: orderShipping.shipping
            })
            .from(orders)
            .leftJoin(auth, eq(orders.userId, auth.id))
            .innerJoin(orderAddress, eq(orderAddress.orderId, orders.id))
            .leftJoin(orderShipping, eq(orderShipping.orderId, orders.id))
            .where(eq(orders.id, updatedShipping.orderId))
            .limit(1)

          if (!orderData?.email) {
            throw new Error(
              `Email customer tidak ditemukan untuk order ${order_no}`
            )
          }

          // Kirim notifikasi pesanan dikirim
          await sendShippingEmail({
            email: orderData.email,
            recipientName: orderData.recipientName,
            orderNumber: orderData.orderNumber,
            awb: updatedShipping.awb,
            shipping: orderData.shipping
          })

          console.log(
            `[EMAIL] Shipping notification sent: ${orderData.orderNumber}`
          )
        } catch (emailError) {
          // Kegagalan email tidak menggagalkan respons webhook
          console.error(
            '[EMAIL] Gagal mengirim shipping notification:',
            emailError.message
          )
        }
      }
      
      if (status === 'Received' && existingShipping.status !== 'Received') {
        console.log('INI SUDAH SENT')
        try {
          // Ambil data order, email customer, dan alamat penerima
          const [orderData] = await db
            .select({
              email: auth.email,
              orderNumber: orders.orderNumber,
              recipientName: orderAddress.recipientName
            })
            .from(orders)
            .leftJoin(auth, eq(orders.userId, auth.id))
            .innerJoin(orderAddress, eq(orderAddress.orderId, orders.id))
            .where(eq(orders.id, updatedShipping.orderId))
            .limit(1)

          if (!orderData?.email) {
            throw new Error(
              `Email customer tidak ditemukan untuk order ${order_no}`
            )
          }

          // Kirim notifikasi pesanan dikirim
          await deliveredShippingEmail({
            email: orderData.email,
            recipientName: orderData.recipientName,
            orderNumber: orderData.orderNumber,
          })

          console.log(
            `[EMAIL] Shipping notification sent: ${orderData.orderNumber}`
          )
        } catch (emailError) {
          // Kegagalan email tidak menggagalkan respons webhook
          console.error(
            '[EMAIL] Gagal mengirim shipping notification:',
            emailError.message
          )
        }
      }

      // 4. Respons webhook
      return res.json({
        status: true,
        message: 'Shipping updated',
        data: updatedShipping
      })
    } catch (error) {
      console.error('WEBHOOK SHIPPING ERROR = ', error)

      return res.status(error.status || 500).json({
        status: false,
        message: error.message
      })
    }
  }

  async pickupOrder(req, res) {
    try {
      const body = req.body

      const options = {
        method: 'POST',
        url: `${process.env.RAJAONGKIR_SHIPPING_URL}/order/api/v1/pickup/request`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_SHIPPING_API_KEY,
          'Content-Type': 'application/json'
        },
        data: body
      }

      const response = await axios.request(options)

      console.log('pickupOrder response = ', response?.data)

      if (response?.data?.meta?.code !== 201) {
        throw {
          status: 400,
          message: response?.data?.meta?.message || 'Request invalid'
        }
      }

      const pickupData = response.data.data

      if (!Array.isArray(pickupData) || pickupData.length === 0) {
        throw {
          status: 400,
          message: 'Pickup data is empty'
        }
      }

      for (const item of pickupData) {
        await db
          .update(shipping)
          .set({
            awb: item.awb,
            status: item.status,
            updatedAt: new Date()
          })
          .where(eq(shipping.shippingNo, item.order_no))
      }

      return res.json({
        status: true,
        results: pickupData
      })

    } catch (error) {
      console.error('pickupOrder error:', error)

      return res.status(error.status || 500).json({
        status: false,
        message: error.message || 'Internal server error'
      })
    }
  }

  async downloadLabel(req, res) {
    try {
      const { orderId } = req.params

      if (!orderId) {
        return res.status(400).json({
          status: false,
          message: 'orderId is required'
        })
      }

      // 1. Cari order
      const [order] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)

      if (!order) {
        return res.status(404).json({
          status: false,
          message: 'Order not found'
        })
      }

      // 2. Pastikan shipping sudah dibuat / pickup sudah dilakukan
      const [shippingData] = await db
        .select({
          shippingId: shipping.shippingId,
          shippingNo: shipping.shippingNo,
          awb: shipping.awb,
          status: shipping.status
        })
        .from(shipping)
        .where(eq(shipping.orderId, orderId))
        .limit(1)

      if (!shippingData) {
        return res.status(400).json({
          status: false,
          message: 'Shipping data not found for this order'
        })
      }

      if (!shippingData.awb) {
        return res.status(400).json({
          status: false,
          message: 'AWB not found. Please schedule pickup first.'
        })
      }

      const orderNo = shippingData.shippingNo

      if (!orderNo) {
        return res.status(400).json({
          status: false,
          message: 'Shipping number not found'
        })
      }

      // 3. Request generate label ke RajaOngkir / Komerce
      const response = await axios.post(
        `${process.env.RAJAONGKIR_SHIPPING_URL}/order/api/v1/orders/print-label`,
        null,
        {
          params: {
            page: 'page_6',
            order_no: orderNo
          },
          headers: {
            'x-api-key': process.env.RAJAONGKIR_SHIPPING_API_KEY,
          }
        }
      )

      const result = response.data

      if (
        !result?.meta ||
        result.meta.status !== 'success' ||
        !result.data?.base_64
      ) {
        return res.status(result?.meta?.code || 422).json({
          status: false,
          message:
            result?.meta?.message ||
            'Failed to generate shipping label',
          data: result?.data || null
        })
      }

      // 4. Decode Base64 menjadi PDF
      const pdfBuffer = Buffer.from(result.data.base_64, 'base64')

      // 5. Kirim PDF ke browser
      const filename = `shipping-label-${order.orderNumber}.pdf`

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      )
      res.setHeader('Content-Length', pdfBuffer.length)

      return res.send(pdfBuffer)
    } catch (error) {
      console.error('pickupOrder error:', error)

      return res.status(error.status || 500).json({
        status: false,
        message: error.message || 'Internal server error'
      })
    }
  }

  async getShippingHistory(req, res) {
    try {
      const {courier, awb} = req.params
      console.log('URL = ', `${process.env.RAJAONGKIR_SHIPPING_URL}/order/api/v1/orders/history-airway-bill?shipping=${courier}&airway_bill=${awb}`)

      const options = {
        method: 'GET',
        url: `${process.env.RAJAONGKIR_SHIPPING_URL}/order/api/v1/orders/history-airway-bill?shipping=${courier.toLowerCase()}&airway_bill=${awb}`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_SHIPPING_API_KEY,
          'Content-Type': 'application/json'
        }
      }

      const response = await axios.request(options)

      console.log('RESPONSE = ', response)

      if (response && response.data.meta.code === 200) {
        res.json({
          results: response.data.data
        })
      } else {
        throw {
          code: 400,
          message: "Request invalid"
        }
      }
    } catch (error) {
      return res.status(error.status || 500).json({
        status: false,
        message: error.message
      })
    }
  }
}

export default new Shipping();