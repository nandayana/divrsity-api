import crypto from 'crypto'
import { eq, and } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { carts, cartItems, variants } from '../../db/schema/index.js'

const CART_COOKIE_NAME = 'cart_token'

const CART_EXPIRES_DAYS = 30

function generateCartToken() {
  return crypto.randomBytes(32).toString('hex')
}

function hashCartToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
}

function setCartCookie(res, token) {
  res.cookie(CART_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CART_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function clearCartCookie(res) {
  res.clearCookie(CART_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

async function getCurrentCart(req) {
  // ==============================
  // USER LOGIN
  // ==============================
  if (req.user?.id) {
    const cart = await db.query.carts.findFirst({
      where: eq(carts.userId, req.user.id),
    })

    return cart
  }

  // ==============================
  // GUEST
  // ==============================

  const token = req.cookies?.[CART_COOKIE_NAME]

  if (!token) {
    return null
  }

  const tokenHash = hashCartToken(token)

  const cart = await db.query.carts.findFirst({
    where: eq(carts.tokenHash, tokenHash),
  })

  return cart
}

class Cart {
  async getCart(req, res) {
    try {
      const cart = await getCurrentCart(req)

      if (!cart) {
        return res.json({
          success: true,
          data: {
            id: null,
            items: [],
            totalItems: 0,
            subtotal: 0,
          },
        })
      }

      const items = await db.query.cartItems.findMany({
        where: eq(cartItems.cartId, cart.id),
        with: {
          variant: {
            with: {
              product: {
                with: {
                  images: true,
                  category: true
                }
              },
              color: true,
              size: true,
            },
          },
          cart: true
        },
      });

      let totalItems = 0
      let subtotal = 0

      const formattedItems = items
        .map((item) => {
          const variant = item.variant
          const product = variant.product
          const cart = variant.cart
          const price = Number(
            variant.priceOverride ?? product.basePrice
          )
          const availableStock = Math.max( 0, variant.stock - variant.reservedStock )
          const isOutOfStock = availableStock < 1

          const itemSubtotal = price * item.quantity

          totalItems += item.quantity
          subtotal += itemSubtotal

          return {
            id: item.id,
            variantId: variant.id,
            quantity: item.quantity,
            product: {
              name: product.name,
              category: product.category.name,
              images: product.images,
              basePrice: product.basePrice,
              discountPercent: product.discountPercent
            },
            cart,
            variant: {
              id: variant.id,
              sku: variant.sku,
              color: variant.color,
              size: variant.size,
            },
            price,
            subtotal: itemSubtotal,
            stock: variant.stock,
            isOutOfStock
          }
        })
        .sort((a, b) => a.variantId.localeCompare(b.variantId))

      return res.json({
        success: true,
        data: {
          id: cart.id,
          items: formattedItems,
          totalItems,
          subtotal,
        },
      })
    } catch (error) {
      console.error('GET CART ERROR:', error)

      return res.status(500).json({
        success: false,
        message: 'Failed to get cart',
      })
    }
  }

  async addCartItem(req, res) {
    try {
      const { variantId, quantity } = req.body

      if (!variantId) {
        return res.status(400).json({
          success: false,
          message: 'variantId is required',
        })
      }

      const qty = Number(quantity)

      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: 'quantity must be a positive integer',
        })
      }

      // ==============================
      // GET VARIANT
      // ==============================

      const variant = await db.query.variants.findFirst({
        where: eq(variants.id, variantId),
      })

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found',
        })
      }

      // ==============================
      // CHECK STOCK
      // ==============================

      if (variant.stock <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Product is out of stock',
        })
      }

      // ==============================
      // GET / CREATE CART
      // ==============================

      let cart = await getCurrentCart(req)

      if (!cart) {
        const token = await generateCartToken()
        const tokenHash = await hashCartToken(token)

        const expiresAt = new Date()

        expiresAt.setDate(
          expiresAt.getDate() + CART_EXPIRES_DAYS
        )

        const [newCart] = await db
          .insert(carts)
          .values({
            userId: req.user?.id ?? null,
            tokenHash,
            expiresAt,
          })
          .returning()

        cart = newCart

        // Guest
        if (!req.user?.id) {
          setCartCookie(res, token)
        }
      }

      // ==============================
      // CHECK EXISTING ITEM
      // ==============================

      const existingItem = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.variantId, variantId)
        ),
      })

      if (existingItem) {
        const newQuantity =
          existingItem.quantity + qty

        if (newQuantity > variant.stock) {
          return res.status(400).json({
            success: false,
            message: `Only ${variant.stock} items available`,
          })
        }

        const [updatedItem] = await db
          .update(cartItems)
          .set({
            quantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(cartItems.id, existingItem.id))
          .returning()

        return res.json({
          success: true,
          message: 'Cart updated',
          data: updatedItem,
        })
      }

      // ==============================
      // CREATE ITEM
      // ==============================

      if (qty > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Only ${variant.stock} items available`,
        })
      }

      const [item] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          variantId,
          quantity: qty,
        })
        .returning()

      return res.status(201).json({
        success: true,
        message: 'Item added to cart',
        data: item,
      })
    } catch (error) {
      console.error('ADD CART ITEM ERROR:', error)

      return res.status(500).json({
        success: false,
        message: 'Failed to add item to cart',
      })
    }
  }

  async updateCartItem(req, res) {
    try {
      const { variantId } = req.params
      const quantity = Number(req.body.quantity)

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'quantity must be a positive integer',
        })
      }

      const cart = await getCurrentCart(req)

      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found',
        })
      }

      const item = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.variantId, variantId)
        ),

        with: {
          variant: true,
        },
      })

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Cart item not found',
        })
      }

      if (quantity > (item.variant.stock - item.variant.reservedStock)) {
        return res.status(400).json({
          success: false,
          message: `Only ${item.variant.stock} items available`,
        })
      }

      const [updatedItem] = await db
        .update(cartItems)
        .set({
          quantity,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, item.id))
        .returning()

      return res.json({
        success: true,
        message: 'Cart item updated',
        data: updatedItem,
      })
    } catch (error) {
      console.error('UPDATE CART ITEM ERROR:', error)

      return res.status(500).json({
        success: false,
        message: 'Failed to update cart item',
      })
    }
  }

  async deleteCartItem(req, res) {
    try {
      const { variantId } = req.params

      const cart = await getCurrentCart(req)

      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found',
        })
      }

      const item = await db.query.cartItems.findFirst({
        where: and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.variantId, variantId)
        ),
      })

      if (!item) {
        return res.status(404).json({
          success: false,
          message: 'Cart item not found',
        })
      }

      await db
        .delete(cartItems)
        .where(eq(cartItems.id, item.id))

      return res.json({
        success: true,
        message: 'Item removed from cart',
      })
    } catch (error) {
      console.error('REMOVE CART ITEM ERROR:', error)

      return res.status(500).json({
        success: false,
        message: 'Failed to remove item',
      })
    }
  }

  async deleteCart(req, res) {
    try {
      const cart = await getCurrentCart(req)

      if (!cart) {
        return res.json({
          success: true,
          message: 'Cart already empty',
        })
      }

      await db
        .delete(cartItems)
        .where(eq(cartItems.cartId, cart.id))

      return res.json({
        success: true,
        message: 'Cart cleared',
      })
    } catch (error) {
      console.error('CLEAR CART ERROR:', error)

      return res.status(500).json({
        success: false,
        message: 'Failed to clear cart',
      })
    }
  }
}

export default new Cart()