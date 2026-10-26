import axios from "axios";
import { payments, orders, orderItems, variants, shipping, orderAddress, orderShipping, products, colors, sizes, auth } from "../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../utils/helper.js";
import { db } from "../../db/index.js";
import { eq, inArray, sql } from "drizzle-orm";
import crypto from 'crypto';
import { sendPaymentSuccessEmail } from "../../services/email.service.js";

async function createKomerceShipping(orderId) {

  // 1. CEK SHIPPING SUDAH ADA
  const existingShipping = await db
    .select()
    .from(shipping)
    .where(
      eq(
        shipping.orderId,
        orderId
      )
    )
    .limit(1);

  if (existingShipping.length) {

    console.log(
      `[KOMERCE] Shipping sudah ada untuk order ${orderId}`
    );

    return existingShipping[0];
  }

  // 2. AMBIL ORDER
  const orderResult = await db
    .select()
    .from(orders)
    .where(
      eq(
        orders.id,
        orderId
      )
    )
    .limit(1);

  if (!orderResult.length) {
    throw new Error(
      `Order ${orderId} tidak ditemukan`
    );
  }

  const order =
    orderResult[0];

  // 3. AMBIL ADDRESS
  const addressResult = await db
    .select()
    .from(orderAddress)
    .where(
      eq(
        orderAddress.orderId,
        orderId
      )
    )
    .limit(1);

  if (!addressResult.length) {
    throw new Error(
      `Address untuk order ${order.orderNumber} tidak ditemukan`
    );
  }

  const address =
    addressResult[0];

  const [customer] = await db
    .select({
      email: auth.email
    })
    .from(auth)
    .where(eq(auth.id, order.userId))
    .limit(1)

  if (!customer?.email) {
    throw new Error(
      `Email customer untuk order ${order.orderNumber} tidak ditemukan`
    )
  }

  // 4. AMBIL SHIPPING DATA
  const orderShippingResult =
    await db
      .select()
      .from(orderShipping)
      .where(
        eq(
          orderShipping.orderId,
          orderId
        )
      )
      .limit(1);

  if (!orderShippingResult.length) {
    throw new Error(
      `Order shipping untuk ${order.orderNumber} tidak ditemukan`
    );
  }

  const orderShippingData =
    orderShippingResult[0];

  // 5. AMBIL ORDER ITEMS
  const items = await db
    .select({
      productName: products.name,
      colorName: colors.name,
      sizeName: sizes.name,
      sku: variants.sku,
      price: orderItems.price,
      quantity: orderItems.quantity,
      subtotal: orderItems.subtotal
    })
    .from(orderItems)
    .innerJoin(
      variants,
      eq(
        orderItems.variantId,
        variants.id
      )
    )
    .innerJoin(
      products,
      eq(
        variants.productId,
        products.id
      )
    )
    .innerJoin(
      colors,
      eq(
        variants.colorId,
        colors.id
      )
    )
    .innerJoin(
      sizes,
      eq(
        variants.sizeId,
        sizes.id
      )
    )
    .where(
      eq(
        orderItems.orderId,
        orderId
      )
    );

  if (!items.length) {
    throw new Error(
      `Order items untuk ${order.orderNumber} tidak ditemukan`
    );
  }

  // 6. FORMAT ORDER DETAILS
  const orderDetails =
    items.map((item) => {
      return {
        product_name: item.productName,
        product_variant_name: `${item.colorName} / ${item.sizeName}`,
        product_price: Number(item.price),
        product_weight: 500, // dalam gram
        product_width: 20,
        product_height: 5 * item.quantity,
        product_length: 30,
        qty: item.quantity,
        subtotal: Number(item.subtotal)
      };
    });

  // 7. DESTINATION PIN POINT
  let destinationPinPoint = null;

  /* if (address.latitude && address.longitude) {
    destinationPinPoint = `${address.latitude},${address.longitude}`;
  } */

  destinationPinPoint = `${address.latitude},${address.longitude}`;

  // 8. VALIDASI DESTINATION ID
  if (!address.destinationId) {
    throw new Error(
      `destinationId tidak tersedia untuk order ${order.orderNumber}`
    );
  }

  // 9. PAYLOAD KOMERCE
  const payload = {
    /* order_date: order.createdAt.toISOString().slice(0, 10), */
    order_date: new Date().toISOString().slice(0, 10),
    brand_name: process.env.RAJAONGKIR_SHIPPING_BRAND_NAME,
    shipper_name: process.env.RAJAONGKIR_SHIPPING_NAME,
    shipper_phone: process.env.RAJAONGKIR_SHIPPING_PHONE,
    shipper_destination_id: Number(process.env.RAJAONGKIR_SHIPPING_ID),
    shipper_address: process.env.RAJAONGKIR_SHIPPING_ADDRESS,
    origin_pin_point: process.env.RAJAONGKIR_SHIPPING_PINT,
    receiver_name: address.recipientName,
    receiver_phone: address.phone,
    receiver_destination_id: Number(address.destinationId),
    receiver_address: address.address,
    shipper_email: process.env.RAJAONGKIR_SHIPPING_EMAIL,
    destination_pin_point: destinationPinPoint,
    shipping: orderShippingData.shipping,
    shipping_type: orderShippingData.shippingType,
    payment_method: 'BANK TRANSFER',
    shipping_cost: Number(orderShippingData.shippingCost),
    shipping_cashback: Number(orderShippingData.shippingCashback),
    service_fee: Number(orderShippingData.serviceFee),
    additional_cost: Number(orderShippingData.additionalCost),
    grand_total: Number(orderShippingData.grandTotal),
    cod_value: Number(orderShippingData.codValue),
    insurance_value: Number(orderShippingData.insuranceValue),
    notes: orderShippingData.notes || `Order ${order.orderNumber}`,
    order_details: orderDetails
  };

  // 10. LOG PAYLOAD
  console.log(
    '[KOMERCE REQUEST]',
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  if (orderShippingData.shipping === 'Pickup') {
    try {
      console.log('REQUEST EMAIL')
      await sendPaymentSuccessEmail({
        email: customer.email,
        recipientName: address.recipientName,
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal,
        shippingCost: orderShippingData.shippingCost,
        products: orderDetails
      })
    } catch (error) {
      console.error(
        `[EMAIL] Gagal mengirim email pembayaran untuk ${order.orderNumber}:`,
        error.message
      )
    }
  }

  // 11. REQUEST KE KOMERCE
  const response =
    await axios.post(
      `${process.env.RAJAONGKIR_PAYMENT_URL}/order/api/v1/orders/store`,
      payload,
      {
        headers: {
          'x-api-key': process.env.RAJAONGKIR_PAYMENT_API_KEY,
          'Content-Type': 'application/json'
        },
      }
    );

  // 12. LOG RESPONSE
  console.log(
    '[KOMERCE RESPONSE]',
    JSON.stringify(
      response.data,
      null,
      2
    )
  );

  // 13. AMBIL DATA RESPONSE
  const komerceData = response.data?.data;

  if (!komerceData) {
    throw new Error(
      'Response Komerce tidak memiliki data'
    );
  }

  // 14. VALIDASI SHIPPING ID
  if (!komerceData.order_id) {
    throw new Error(
      `Komerce tidak mengembalikan order_id: ${JSON.stringify(response.data)}`
    );
  }

  // 15. SIMPAN SHIPPING
  const [newShipping] = await db.insert(shipping).values({
    shippingId: String(komerceData.order_id),
    shippingNo: komerceData.order_no ? String(komerceData.order_no) : null,
    status: komerceData.status || 'PENDING',
    orderId
  })
    .returning();

  try {
    console.log('REQUEST EMAIL')
    await sendPaymentSuccessEmail({
      email: customer.email,
      recipientName: address.recipientName,
      orderNumber: order.orderNumber,
      grandTotal: order.grandTotal,
      shippingCost: orderShippingData.shippingCost,
      products: orderDetails
    })
  } catch (error) {
    console.error(
      `[EMAIL] Gagal mengirim email pembayaran untuk ${order.orderNumber}:`,
      error.message
    )
  }

  // 16. SUCCESS
  console.log(`[KOMERCE] Shipping berhasil dibuat. Order: ${order.orderNumber}, Shipping: ${newShipping.shippingId}`);

  return newShipping;
}

class Payment {
  async getList(req, res) {
    try {
      const options = {
        method: 'GET',
        url: `${process.env.RAJAONGKIR_PAYMENT_URL}/user/api/v1/user/methods`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_PAYMENT_API_KEY,
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
      return res.status(error.code || 500).json({
        status: false,
        message: error.message
      })
    }
  }

  /* async createQRPayment(req, res) {
    try {
      const options = {
        method: 'POST',
        url: `${process.env.RAJAONGKIR_PAYMENT_URL}/user/api/v1/user/payment/create`,
        headers: {
          'x-api-key': process.env.RAJAONGKIR_PAYMENT_API_KEY,
          'Content-Type': 'application/json'
        },
        data: {
          "order_id": "KOM12345",
          "payment_type": "qris",
          "amount": 100000,
          "customer": {
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "081234567890"
          },
          "items": [
            {
              "name": "Product A",
              "quantity": 2,
              "price": 50000
            }
          ],
          "callback_url": "https://yoursite.com/callback",
          "callback_API_KEY": "your-generated-key"
        }
      }
    } catch (error) {
      return res.status(error.status || 500).json({
        status: false,
        message: error.message
      })
    }

  } */

  uploadImage = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Invalid request" };
      console.log('EXIST = ', existing)

      const body = {};
      if (req.body.name) body.name = req.body.name;
      if (req.body.description !== undefined) body.description = req.body.description;

      if (req.file) {
        body.image = `/${process.env.MEDIA_PATH}/${req.file.filename}`;
        if (existing.image) {
          deleteFile(existing.image);
        }
      }

      const [result] = await db.update(payments).set(body).where(eq(payments.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Updated successfully', data: result });
    } catch (error) {
      return handleError(res, error, req.file);
    }
  }

  updatePaymentStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Payment ID format" };

      const [existing] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Payment not found" };

      const [result] = await db.update(payments).set({ status }).where(eq(payments.id, id)).returning();

      return res.status(200).json({
        status: true,
        message: 'Payment status updated successfully',
        data: result
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  callbackPayment = async (req, res) => {
    try {
      const body = req.body;
      const headers = req.headers;

      // 1. RAW PAYLOAD
      const rawPayload =
        req.rawBody ||
        JSON.stringify(body);

      // 2. AMBIL SIGNATURE
      const incomingSignature =
        headers['x-callback-api-key'];

      if (!incomingSignature) {
        console.warn(
          'Unauthorized: Header x-callback-api-key tidak ditemukan.'
        );

        return res.status(401).json({
          status: false,
          message:
            'Unauthorized: Missing Signature Header'
        });
      }

      // 3. GENERATE HMAC
      const secretKey =
        process.env.PAYMENT_CALLBACK_API_KEY;

      if (!secretKey) {
        console.error(
          'PAYMENT_CALLBACK_API_KEY belum diset.'
        );

        return res.status(500).json({
          status: false,
          message:
            'Payment callback configuration error'
        });
      }

      const localHash = crypto
        .createHmac(
          'sha256',
          secretKey
        )
        .update(rawPayload)
        .digest('hex');

      // 4. VALIDASI SIGNATURE
      const isMatched =
        localHash.length ===
        incomingSignature.length &&
        crypto.timingSafeEqual(
          Buffer.from(localHash),
          Buffer.from(incomingSignature)
        );

      if (!isMatched) {
        console.warn(
          'Unauthorized: Signature mismatch!'
        );

        return res.status(401).json({
          status: false,
          message:
            'Unauthorized: Invalid Signature'
        });
      }

      // 5. AMBIL PAYMENT ID
      const paymentId =
        body.payment_id ||
        body.transaction_id ||
        body.id;

      const rawStatus = (
        body.status ||
        body.transaction_status ||
        ''
      ).toLowerCase();

      if (!paymentId) {
        return res.status(400).json({
          status: false,
          message:
            'Bad Request: payment_id missing in payload'
        });
      }

      // 6. CARI PAYMENT
      const existingPayment = await db
        .select()
        .from(payments)
        .where(
          eq(
            payments.paymentId,
            String(paymentId)
          )
        )
        .limit(1);

      if (!existingPayment.length) {
        console.warn(
          `Payment ${paymentId} tidak ditemukan.`
        );

        return res.status(404).json({
          status: false,
          message:
            'Payment record not found'
        });
      }

      const currentPayment =
        existingPayment[0];

      // 7. CEK STATUS PAYMENT
      let newPaymentStatus = 'PENDING';
      let newOrderStatus = 'PENDING';

      if (
        [
          'paid',
          'completed',
          'success',
          'settlement'
        ].includes(rawStatus)
      ) {
        newPaymentStatus = 'PAID';
        newOrderStatus = 'PAID';

      } else if (
        [
          'expired',
          'cancel',
          'cancelled'
        ].includes(rawStatus)
      ) {
        newPaymentStatus = 'EXPIRED';
        newOrderStatus = 'CANCELLED';

      } else if (
        [
          'failed',
          'deny'
        ].includes(rawStatus)
      ) {
        newPaymentStatus = 'FAILED';
        newOrderStatus = 'FAILED';
      }

      // 8. CEK STATUS SEBELUMNYA
      const previousPaymentStatus =
        currentPayment.status;

      const wasAlreadyPaid =
        previousPaymentStatus === 'PAID';

      const wasAlreadyFailed =
        [
          'FAILED',
          'EXPIRED'
        ].includes(
          previousPaymentStatus
        );

      // 9. UPDATE PAYMENT + ORDER + STOCK
      await db.transaction(async (tx) => {

        // UPDATE PAYMENT
        await tx
          .update(payments)
          .set({
            status: newPaymentStatus
          })
          .where(
            eq(
              payments.id,
              currentPayment.id
            )
          );

        if (!currentPayment.orderId) {
          return;
        }

        // UPDATE ORDER
        await tx
          .update(orders)
          .set({
            status: newOrderStatus,
            updatedAt: new Date()
          })
          .where(
            eq(
              orders.id,
              currentPayment.orderId
            )
          );

        // =======================================================
        // STOCK
        // =======================================================

        // Jangan proses stock kalau status sebelumnya
        // sudah final.
        //
        // Contoh:
        //
        // PAID -> PAID
        // FAILED -> FAILED
        // EXPIRED -> EXPIRED
        //
        // Tidak akan mengubah stock lagi.

        if (
          wasAlreadyPaid ||
          wasAlreadyFailed
        ) {
          return;
        }

        // -------------------------------------------------------
        // AMBIL ORDER ITEMS
        // -------------------------------------------------------

        const items = await tx
          .select({
            variantId:
              orderItems.variantId,

            quantity:
              orderItems.quantity
          })
          .from(orderItems)
          .where(
            eq(
              orderItems.orderId,
              currentPayment.orderId
            )
          );

        if (!items.length) {
          console.warn(
            `Order items tidak ditemukan untuk order ${currentPayment.orderId}`
          );

          return;
        }

        // =======================================================
        // PAYMENT BERHASIL
        // =======================================================

        if (
          newPaymentStatus === 'PAID'
        ) {

          for (const item of items) {

            await tx
              .update(variants)
              .set({
                // Lepaskan reserved stock
                reservedStock: sql`
                GREATEST(
                  ${variants.reservedStock} -
                  ${item.quantity},
                  0
                )
              `,

                // Kurangi stock sebenarnya
                stock: sql`
                GREATEST(
                  ${variants.stock} -
                  ${item.quantity},
                  0
                )
              `
              })
              .where(
                eq(
                  variants.id,
                  item.variantId
                )
              );
          }

          // =======================================================
          // PAYMENT GAGAL / EXPIRED
          // =======================================================

        } else if (
          [
            'FAILED',
            'EXPIRED'
          ].includes(
            newPaymentStatus
          )
        ) {

          for (const item of items) {

            await tx
              .update(variants)
              .set({
                // Hanya lepaskan reserved stock
                reservedStock: sql`
                GREATEST(
                  ${variants.reservedStock} -
                  ${item.quantity},
                  0
                )
              `
              })
              .where(
                eq(
                  variants.id,
                  item.variantId
                )
              );
          }
        }
      });

      // =========================================================
      // 10. CREATE SHIPPING
      // =========================================================

      //
      // Hanya:
      //
      // PENDING -> PAID
      //
      // Tidak:
      //
      // PAID -> PAID
      //

      if (newPaymentStatus === 'PAID' && !wasAlreadyPaid && currentPayment.orderId) {
        try {
          await createKomerceShipping(currentPayment.orderId);
        } catch (shippingError) {
          console.error(`[KOMERCE] Gagal membuat shipping untuk order ${currentPayment.orderId}:`, shippingError);

          // Payment tetap PAID.
          // Shipping bisa diproses/retry kemudian.
        }
      }

      // =========================================================
      // 11. RESPONSE
      // =========================================================

      console.log(
        `[SUCCESS] Payment ${paymentId} & Order ${currentPayment.orderId} updated to ${newPaymentStatus}`
      );

      return res.status(200).json({
        status: true,
        message:
          'Payment status updated successfully'
      });

    } catch (error) {

      console.error(
        'Error processing payment callback:',
        error
      );

      return res.status(500).json({
        status: false,
        message:
          'Internal server error',
        error:
          error.message
      });
    }
  }

  resendShipping = async (req, res) => {
    try {
      const id = req.body.id
      console.log('ID = ', id)
      if (!id) {
        return res.status(400).json({
          status: false,
          message:
            'Bad Request: order id missing in payload'
        });
      }

      try {
        await createKomerceShipping(id);
      } catch (shippingError) {
        console.error(`[KOMERCE] Gagal membuat shipping untuk order ${currentPayment.orderId}:`, shippingError);
      }

      return res.status(200).json({
        status: true,
        message:
          'Shipping resend successfully'
      });
    } catch (error) {
      console.error(
        'Error processing resend shipping:',
        error
      );

      return res.status(500).json({
        status: false,
        message:
          'Internal server error',
        error:
          error.message
      });
    }
  }

  paymentCheck = async(req, res) => {
    try {
      const body = req.body
      const paymentId = body.paymentId

      const paymentResponse = await axios.get(
        `${process.env.RAJAONGKIR_PAYMENT_URL}/user/api/v1/user/payment/status/${paymentId}`,
        {
          headers: {
            'x-api-key': process.env.RAJAONGKIR_PAYMENT_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      )

      console.log('PAYMENT STATUS = ', paymentResponse.data)

      const rawStatus = (paymentResponse.data.data.status).toLowerCase();

      if (!paymentId) {
        return res.status(400).json({
          status: false,
          message:
            'Bad Request: payment_id missing in payload'
        });
      }

      // 6. CARI PAYMENT
      const existingPayment = await db
        .select()
        .from(payments)
        .where(
          eq(payments.paymentId, String(paymentId))
        )
        .limit(1);

      if (!existingPayment.length) {
        console.warn(
          `Payment ${paymentId} tidak ditemukan.`
        );

        return res.status(404).json({
          status: false,
          message:
            'Payment record not found'
        });
      }

      const currentPayment = existingPayment[0];

      // 7. CEK STATUS PAYMENT
      let newPaymentStatus = 'PENDING';
      let newOrderStatus = 'PENDING';

      if (['paid', 'completed', 'success', 'settlement'].includes(rawStatus)) {
        newPaymentStatus = 'PAID';
        newOrderStatus = 'PAID';
      } else if (['expired', 'cancel', 'cancelled'].includes(rawStatus)) {
        newPaymentStatus = 'EXPIRED';
        newOrderStatus = 'CANCELLED';
      } else if (['failed', 'deny'].includes(rawStatus)) {
        newPaymentStatus = 'FAILED';
        newOrderStatus = 'FAILED';
      }

      // 8. CEK STATUS SEBELUMNYA
      const previousPaymentStatus = currentPayment.status;

      const wasAlreadyPaid = previousPaymentStatus === 'PAID';

      const wasAlreadyFailed = ['FAILED', 'EXPIRED'].includes(previousPaymentStatus);

      // 9. UPDATE PAYMENT + ORDER + STOCK
      await db.transaction(async (tx) => {

        // UPDATE PAYMENT
        await tx
          .update(payments)
          .set({
            status: newPaymentStatus
          })
          .where(
            eq(
              payments.id,
              currentPayment.id
            )
          );

        if (!currentPayment.orderId) {
          return;
        }

        // UPDATE ORDER
        await tx
          .update(orders)
          .set({
            status: newOrderStatus,
            updatedAt: new Date()
          })
          .where(
            eq(
              orders.id,
              currentPayment.orderId
            )
          );

        // =======================================================
        // STOCK
        // =======================================================

        // Jangan proses stock kalau status sebelumnya
        // sudah final.
        //
        // Contoh:
        //
        // PAID -> PAID
        // FAILED -> FAILED
        // EXPIRED -> EXPIRED
        //
        // Tidak akan mengubah stock lagi.

        if (
          wasAlreadyPaid ||
          wasAlreadyFailed
        ) {
          return;
        }

        // -------------------------------------------------------
        // AMBIL ORDER ITEMS
        // -------------------------------------------------------

        const items = await tx
          .select({
            variantId:
              orderItems.variantId,

            quantity:
              orderItems.quantity
          })
          .from(orderItems)
          .where(
            eq(
              orderItems.orderId,
              currentPayment.orderId
            )
          );

        if (!items.length) {
          console.warn(
            `Order items tidak ditemukan untuk order ${currentPayment.orderId}`
          );

          return;
        }

        // =======================================================
        // PAYMENT BERHASIL
        // =======================================================

        if (
          newPaymentStatus === 'PAID'
        ) {

          for (const item of items) {

            await tx
              .update(variants)
              .set({
                // Lepaskan reserved stock
                reservedStock: sql`
                GREATEST(
                  ${variants.reservedStock} -
                  ${item.quantity},
                  0
                )
              `,

                // Kurangi stock sebenarnya
                stock: sql`
                GREATEST(
                  ${variants.stock} -
                  ${item.quantity},
                  0
                )
              `
              })
              .where(
                eq(
                  variants.id,
                  item.variantId
                )
              );
          }

          // =======================================================
          // PAYMENT GAGAL / EXPIRED
          // =======================================================

        } else if (
          [
            'FAILED',
            'EXPIRED'
          ].includes(
            newPaymentStatus
          )
        ) {

          for (const item of items) {

            await tx
              .update(variants)
              .set({
                // Hanya lepaskan reserved stock
                reservedStock: sql`
                GREATEST(
                  ${variants.reservedStock} -
                  ${item.quantity},
                  0
                )
              `
              })
              .where(
                eq(
                  variants.id,
                  item.variantId
                )
              );
          }
        }
      });

      // =========================================================
      // 10. CREATE SHIPPING
      // =========================================================

      //
      // Hanya:
      //
      // PENDING -> PAID
      //
      // Tidak:
      //
      // PAID -> PAID
      //

      console.log('ASEEEEM = ', newPaymentStatus === 'PAID' && !wasAlreadyPaid && currentPayment.orderId)

      if (newPaymentStatus === 'PAID' && !wasAlreadyPaid && currentPayment.orderId) {
        try {
          await createKomerceShipping(currentPayment.orderId);
        } catch (shippingError) {
          console.error(`[KOMERCE] Gagal membuat shipping untuk order ${currentPayment.orderId}:`, shippingError);

          // Payment tetap PAID.
          // Shipping bisa diproses/retry kemudian.
        }
      }

      // =========================================================
      // 11. RESPONSE
      // =========================================================

      console.log(
        `[SUCCESS] Payment ${paymentId} & Order ${currentPayment.orderId} updated to ${newPaymentStatus}`
      );

      return res.status(200).json({
        status: true,
        message:
          'Payment status updated successfully'
      });
    } catch (error) {
      console.error(
        'Error processing payment callback:',
        error
      );

      return res.status(500).json({
        status: false,
        message:
          'Internal server error',
        error:
          error.message
      });
    }
  }
}

export default new Payment();