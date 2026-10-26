import { relations } from "drizzle-orm";
import { products, variants, productImages, colors, sizes, categories } from "./product.js";
import { carts, cartItems } from "./cart.js";
import { orderAddress, orderItems, orders, orderShipping } from "./order.js";
import { auth, user } from "./auth.js";
import { shipping } from "./shipping.js";
import { payments } from "./payment.js";

// --- CATEGORIES ---
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// --- PRODUCTS ---
export const productsRelations = relations(products, ({ many, one }) => ({
  variants: many(variants),
  images: many(productImages),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

// --- VARIANTS ---
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  color: one(colors, {
    fields: [variants.colorId],
    references: [colors.id],
  }),
  size: one(sizes, {
    fields: [variants.sizeId],
    references: [sizes.id],
  }),
}));

// --- PRODUCT IMAGES ---
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
  color: one(colors, {
    fields: [productImages.colorId],
    references: [colors.id],
  }),
}));

// --- CARTS & CART ITEMS ---
export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(auth, {
    fields: [carts.userId],
    references: [auth.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  variant: one(variants, {
    fields: [cartItems.variantId],
    references: [variants.id],
  }),
}));

// --- ORDERS & RELATED TABLES ---
export const orderRelations = relations(orders, ({ one, many }) => ({
  payment: one(payments, {
    fields: [orders.id],
    references: [payments.orderId],
  }),
  orderAddress: one(orderAddress, {
    fields: [orders.id],
    references: [orderAddress.orderId],
  }),
  orderShipping: one(orderShipping, {
    fields: [orders.id],
    references: [orderShipping.orderId],
  }),
  shipping: one(shipping, {
    fields: [orders.id],
    references: [shipping.orderId],
  }),
  user: one(auth, {
    fields: [orders.userId],
    references: [auth.id],
  }),
  cart: one(carts, {
    fields: [orders.cartId],
    references: [carts.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  variant: one(variants, {
    fields: [orderItems.variantId],
    references: [variants.id],
  }),
}));

export const orderAddressRelations = relations(orderAddress, ({ one }) => ({
  order: one(orders, {
    fields: [orderAddress.orderId],
    references: [orders.id],
  }),
}));

export const orderShippingRelations = relations(orderShipping, ({ one }) => ({
  order: one(orders, {
    fields: [orderShipping.orderId],
    references: [orders.id],
  }),
}));

export const shippingRelations = relations(shipping, ({ one }) => ({
  order: one(orders, {
    fields: [shipping.orderId],
    references: [orders.id],
  }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id], // ✅ Sudah diperbaiki dari payments.orderId ke orders.id
  }),
}));

// --- AUTH & USER ---
export const authRelations = relations(auth, ({ one }) => ({
  user: one(user),
}));

export const userRelations = relations(user, ({ one }) => ({
  auth: one(auth, {
    fields: [user.authId],
    references: [auth.id],
  }),
}));