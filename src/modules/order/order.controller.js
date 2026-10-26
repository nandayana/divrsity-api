import crypto from 'crypto'
import axios from 'axios'

import {
  eq,
  and,
  gte,
  sql,
  exists,
  lte,
  or,
  ilike,
  desc, isNotNull, isNull, ne
} from 'drizzle-orm'

import { db } from '../../db/index.js'

import {
  auth,
  cartItems,
  variants,
  orders,
  orderItems,
  orderAddress,
  orderShipping,
  payments,
  products,
  shipping
} from '../../db/schema/index.js'

import { handleError } from '../../utils/helper.js'


class Order {

  async createOrder(req, res) {

    let createdOrder = null

    try {
      const body = req.body

      // 1. AUTH USER
      const authData = await db.query.auth.findFirst({
        where: eq(auth.id, req.user.id),
        columns: { id: true, email: true }
      })

      if (!authData) {
        return res.status(401).json({
          status: false,
          message: 'User not found'
        })
      }

      // 2. VALIDASI INPUT
      if (!body.cartId) {
        return res.status(400).json({
          status: false,
          message: 'Cart ID is required'
        })
      }

      if (!body.address) {
        return res.status(400).json({
          status: false,
          message: 'Shipping address is required'
        })
      }

      if (!body.shipping) {
        return res.status(400).json({
          status: false,
          message: 'Shipping information is required'
        })
      }

      if (!body.paymentMethod) {
        return res.status(400).json({
          status: false,
          message: 'Payment method is required'
        })
      }

      // 3. AMBIL CART
      const carts = await db.query.cartItems.findMany({
        where: eq(cartItems.cartId, body.cartId),
        with: {
          variant: {
            with: {
              product: true,
              color: true,
              size: true
            }
          }
        }
      })

      if (!carts.length) {
        return res.status(400).json({
          status: false,
          message: 'Cart is empty'
        })
      }

      // 4. VALIDASI CART
      for (const item of carts) {
        if (!item.variant) {
          return res.status(400).json({
            status: false,
            message: `Variant ${item.variantId} not found`
          })
        }

        if (!item.variant.product) {
          return res.status(400).json({
            status: false,
            message: `Product for variant ${item.variantId} not found`
          })
        }

        if (item.quantity <= 0) {
          return res.status(400).json({
            status: false,
            message: `Invalid quantity for ${item.variant.product.name}`
          })
        }
      }

      // 5. GET VARIANT PRICE
      const getVariantPrice = (variant) => {
        if (variant.priceOverride !== null && variant.priceOverride !== undefined) {
          return Number(variant.priceOverride)
        }

        return Number(variant.product.basePrice)
      }

      // 6. HITUNG SUBTOTAL
      const subtotal = carts.reduce((total, item) => {
        const price = getVariantPrice(item.variant)

        return (total + price * item.quantity)
      },
        0
      )

      const shippingCost = Number(body.shipping.shipping_cost || 0)
      const discount = Number(body.discount || 0)
      const grandTotal = subtotal + shippingCost - discount

      if (grandTotal < 0) {
        return res.status(400).json({
          status: false,
          message: 'Invalid grand total'
        })
      }

      // 7. GENERATE ORDER NUMBER
      const orderNumber = `DIVRSITY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

      // 8. DATABASE TRANSACTION
      createdOrder = await db.transaction(async (tx) => {

        // 8A. RESERVE STOCK
        for (const item of carts) {
          const [reservedVariant] = await tx
            .update(variants)
            .set({
              reservedStock: sql`${variants.reservedStock} + ${item.quantity}`
            })
            .where(
              and(
                // variant yang dimaksud
                eq(variants.id, item.variant.id),
                // available stock cukup
                gte(sql`${variants.stock} - ${variants.reservedStock}`, item.quantity)
              )
            )
            .returning({
              id: variants.id,
              stock: variants.stock,
              reservedStock: variants.reservedStock
            })

          // STOCK TIDAK CUKUP
          if (!reservedVariant) {
            throw new Error(`Stock ${item.variant.product.name} tidak mencukupi`)
          }
        }

        // 8B. CREATE ORDER
        const [newOrder] = await tx
          .insert(orders)
          .values({
            orderNumber,
            userId: req.user.id,
            cartId: body.cartId,
            subtotal,
            shippingCost,
            discount,
            grandTotal,
            status: 'pending',
            expiredAt: null
          })
          .returning()

        // 8C. CREATE ORDER ITEMS
        const orderItemValues = carts.map((item) => {
          const price = getVariantPrice(item.variant)

          return {
            orderId: newOrder.id,
            variantId: item.variant.id,
            name: item.variant.product.name,
            price,
            quantity: item.quantity,
            subtotal: price * item.quantity
          }
        })

        await tx.insert(orderItems).values(orderItemValues)

        // 8D. CREATE ORDER ADDRESS
        await tx.insert(orderAddress).values({
          orderId: newOrder.id,
          recipientName: body.address.recipientName,
          phone: body.address.phone,
          address: body.address.address,
          provinceName: body.address.province_name,
          cityName: body.address.city_name,
          districtName: body.address.district_name,
          subdistrictName: body.address.subdistrict_name,
          postalCode: body.address.zip_code,
          destinationId: body.address.id,
          latitude: '0',
          longitude: '0'
        })

        // 8E. CREATE ORDER SHIPPING
        await tx.insert(orderShipping).values({
          orderId: newOrder.id,
          shipping: body.shipping.shipping_name,
          shippingType: body.shipping.service_name,
          shippingCost: Number(body.shipping.shipping_cost || 0),
          shippingCashback: Number(body.shipping.shipping_cashback || 0),
          serviceFee: Number(body.shipping.service_fee || 0),
          additionalCost: 0,
          grandTotal: Number(grandTotal || 0),
          codValue: 0,
          insuranceValue: 0,
          notes: null
        })

        // RETURN ORDER
        return newOrder
      }
      )

      // 9. CREATE PAYMENT REQUEST
      const paymentItems = carts.map((item) => {
        const price = getVariantPrice(item.variant)

        return {
          name: item.variant.product.name,
          price,
          quantity: item.quantity
        }
      })

      const paymentRequestBody = {
        order_id: orderNumber,
        payment_type: body.paymentMethod,
        amount: grandTotal,
        customer: {
          name: body.address.recipientName,
          email: authData.email,
          phone: body.address.phone
        },
        items: paymentItems,
        callback_url: process.env.PAYMENT_CALLBACK_URL,
        callback_API_KEY: process.env.PAYMENT_CALLBACK_API_KEY
      }

      // 10. REQUEST PAYMENT
      let paymentRequestData = null
      if (body.paymentMethod !== 'direct') {
        const paymentResponse = await axios.post(
          `${process.env.RAJAONGKIR_PAYMENT_URL}/user/api/v1/user/payment/create`,
          paymentRequestBody,
          {
            headers: {
              'x-api-key': process.env.RAJAONGKIR_PAYMENT_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        )

        paymentRequestData = paymentResponse.data.data

        if (!paymentRequestData) { throw new Error('Payment data is empty') }
      }

      // 11. UPDATE ORDER EXPIRED AT
      const paymentExpiredAt = paymentRequestData?.expired_at ? new Date(paymentRequestData.expired_at) : new Date()

      // 12. SAVE PAYMENT
      const paymentValue = {
        orderId: createdOrder.id,
        paymentId: paymentRequestData?.payment_id || new Date().getTime().toString(),
        paymentUrl: paymentRequestData?.payment_url || '',
        vaNumber: paymentRequestData?.va_number || null,
        bankCode: paymentRequestData?.bank_code || null,
        bankName: paymentRequestData?.bank_name || null,
        paymentType: body.paymentMethod || 'direct',
        qrString: paymentRequestData?.qr_string || null,
        amount: Number(paymentRequestData?.amount || paymentRequestBody.amount),
        status: paymentRequestData?.status || 'PENDING',
        expiredAt: paymentExpiredAt,
        createdAt: paymentRequestData?.created_at ? new Date(paymentRequestData?.created_at) : new Date()
      }

      const [payment] = await db.insert(payments).values(paymentValue).returning()

      // CLEAR CART
      await db.delete(cartItems).where(eq(cartItems.cartId, body.cartId))

      // 13. RESPONSE
      return res.status(201).json({
        status: true,
        message: 'Order created successfully',
        data: {
          order: createdOrder,
          payment
        }
      })

    } catch (error) {
      console.error('CREATE ORDER ERROR:', error.response?.data || error)

      // 14. RELEASE RESERVED STOCK
      if (createdOrder) {
        try {
          const orderItemsData = await db.query.orderItems.findMany({
            where: eq(orderItems.orderId, createdOrder.id)
          })

          await db.transaction(
            async (tx) => {
              for (const item of orderItemsData) {
                await tx.update(variants).set({
                  reservedStock: sql`GREATEST(${variants.reservedStock} - ${item.quantity}, 0)`
                }).where(eq(variants.id, item.variantId))
              }

              // CANCEL ORDER
              await tx.update(orders).set({
                status: 'cancelled',
                updatedAt: new Date()
              }).where(eq(orders.id, createdOrder.id))
            }
          )

        } catch (releaseError) {
          console.error('RELEASE RESERVED STOCK ERROR:', releaseError)
        }
      }

      // 15. RETURN ERROR
      return handleError(res, error)
    }
  }

  async getOrder(req, res) {
    try {
      const orderItems = await db.query.orders.findMany({
        where: eq(orders.userId, req.user.id),
        orderBy: desc(orders.createdAt),
        with: {
          payment: true,
          items: {
            with: {
              variant: { // ✅ Diubah dari 'product' ke 'variant'
                with: {
                  product: { // Mengambil produk utama
                    with: {
                      images: true,
                    },
                  },
                  color: {
                    columns: {
                      id: true,
                      name: true,
                    },
                  },
                  size: {
                    columns: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          orderShipping: true,
          orderAddress: true,
          shipping: true,
        },
      });

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        data: orderItems
        /* pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        }, */
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const orderItems = await db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          payment: true,
          orderAddress: true,
          orderShipping: true,
          shipping: true,
          items: {
            with: {
              variant: {
                with: {
                  product: {
                    with: {
                      images: true
                    }
                  },
                  color: {
                    columns: {
                      id: true,
                      name: true,
                    }
                  },
                  size: {
                    columns: {
                      id: true,
                      name: true,
                    }
                  },
                }
              },

            }
          }
        }
      })

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        data: orderItems
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async getOrderList(req, res) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.rows, 10) || 10);
      const offset = (page - 1) * limit;

      const {
        status,
        create_gte,
        create_lte,
        search,
        collection,
        payment_image,
        awb,
        pickup
      } = req.query;

      const conditions = [];

      // 1. Validasi & Filter Tanggal
      if (create_gte) {
        const dateGte = new Date(create_gte);
        if (Number.isNaN(dateGte.getTime())) {
          return res.status(400).json({ status: false, message: 'Invalid create_gte date format' });
        }
        conditions.push(gte(orders.createdAt, dateGte));
      }

      if (create_lte) {
        const dateLte = new Date(create_lte);

        if (Number.isNaN(dateLte.getTime())) {
          return res.status(400).json({
            status: false,
            message: 'Invalid create_lte date format',
          });
        }

        dateLte.setHours(23, 59, 59, 999);

        conditions.push(lte(orders.createdAt, dateLte));
      }

      // 2. Filter Status Pembayaran
      if (status) {
        conditions.push(
          exists(
            db.select({ id: payments.id })
              .from(payments)
              .where(and(eq(payments.orderId, orders.id), ilike(payments.status, status)))
          )
        );
      }

      // 3. Filter Kategori / Collection
      if (collection) {
        conditions.push(
          exists(
            db.select({ id: orderItems.id })
              .from(orderItems)
              .innerJoin(variants, eq(orderItems.variantId, variants.id))
              .innerJoin(products, eq(variants.productId, products.id))
              .where(and(eq(orderItems.orderId, orders.id), eq(products.categoryId, collection)))
          )
        );
      }

      // 4. Filter Bukti Pembayaran (payment_image)
      if (payment_image === 'true') {
        conditions.push(
          exists(
            db.select({ id: payments.id })
              .from(payments)
              .where(and(eq(payments.orderId, orders.id), isNotNull(payments.image), ne(payments.image, '')))
          )
        );
      } else if (payment_image === 'false') {
        conditions.push(
          exists(
            db.select({ id: payments.id })
              .from(payments)
              .where(and(eq(payments.orderId, orders.id), or(isNull(payments.image), eq(payments.image, ''))))
          )
        );
      }

      if (awb === 'true') {
        conditions.push(
          exists(
            db.select({ id: shipping.id })
              .from(shipping)
              .where(
                and(
                  eq(shipping.orderId, orders.id),
                  isNotNull(shipping.awb),
                  ne(shipping.awb, '')
                )
              )
          )
        )
      } else if (awb === 'false') {
        conditions.push(
          exists(
            db.select({ id: shipping.id })
              .from(shipping)
              .where(
                and(
                  eq(shipping.orderId, orders.id),
                  or(
                    isNull(shipping.awb),
                    eq(shipping.awb, '')
                  )
                )
              )
          )
        )
      }
      
      if (pickup === 'true') {
        conditions.push(
          exists(
            db.select({ id: orderShipping.id })
              .from(orderShipping)
              .where(
                and(
                  eq(orderShipping.orderId, orders.id),
                  eq(orderShipping.shipping, 'Pickup')
                )
              )
          )
        )
      } else if (pickup === 'false') {
        conditions.push(
          exists(
            db.select({ id: orderShipping.id })
              .from(orderShipping)
              .where(
                and(
                  eq(orderShipping.orderId, orders.id),
                  or(
                    ne(orderShipping.shipping, 'Pickup'),
                    isNull(orderShipping.shipping)
                  )
                )
              )
          )
        )
      }

      // 5. Pencarian Keyword
      if (search?.trim()) {
        const keyword = `%${search.trim()}%`;
        conditions.push(
          or(
            ilike(orders.shippingNumber, keyword),
            ilike(orders.orderNumber, keyword),
            exists(
              db.select({ id: auth.id })
                .from(auth)
                .where(and(eq(auth.id, orders.userId), ilike(auth.email, keyword)))
            ),
            exists(
              db.select({ id: orderAddress.id })
                .from(orderAddress)
                .where(and(eq(orderAddress.orderId, orders.id), ilike(orderAddress.recipientName, keyword)))
            )
          )
        );
      }

      const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

      // 6. Jalankan Query Order List dan Hitung Total
      const [orderList, totalItems] = await Promise.all([
        db.query.orders.findMany({
          limit,
          offset,
          where: whereCondition,
          orderBy: (orders, { desc }) => [desc(orders.createdAt)],
          with: {
            user: {
              columns: {
                id: true,
                email: true
              }
            },
            payment: true,
            orderAddress: true,
            orderShipping: true,
            shipping: true, // Tambahkan tabel shipping
            items: {
              with: {
                variant: { // ✅ Disesuaikan dengan relasi variantId -> variants
                  with: {
                    product: {
                      columns: {
                        id: true,
                        name: true,
                        categoryId: true
                      }
                    },
                    color: {
                      columns: {
                        id: true,
                        name: true
                      }
                    },
                    size: {
                      columns: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }),
        db.$count(orders, whereCondition)
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        pagination: {
          page,
          limit,
          totalItems,
          totalPages
        },
        data: orderList
      });

    } catch (error) {
      return handleError(res, error);
    }
  }

  async updateAwb(req, res) {
    try {
      const { shippingNumber } = req.body
      const { orderNumber } = req.params

      const updatedOrders = await db
        .update(orders)
        .set({
          shippingNumber: shippingNumber,
          updatedAt: new Date()
        })
        .where(eq(orders.orderNumber, orderNumber))
        .returning()

      if (updatedOrders.length === 0) {
        return res.status(404).json({
          message: `Order dengan nomor ${orderNumber} tidak ditemukan`
        })
      }

      return res.status(200).json({
        status: true,
        message: 'Update successfully',
        data: updatedOrders[0]
      })

    } catch (error) {
      return handleError(res, error);
    }
  }

  async doneOrder(req, res) {
    try {
      const { orderNumber } = req.params

      const [updatedOrder] = await db
        .update(orders)
        .set({
          status: 'DONE',
          updatedAt: new Date()
        })
        .where(eq(orders.orderNumber, orderNumber))
        .returning()

      if (!updatedOrder) {
        return res.status(404).json({
          status: false,
          message: 'Order not found'
        })
      }

      return res.status(200).json({
        status: true,
        message: 'Update successfully',
        data: updatedOrder
      })
    } catch (error) {
      return handleError(res, error)
    }
  }
}

export default new Order()