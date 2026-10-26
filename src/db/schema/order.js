import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  timestamp, uuid, text,
  decimal
} from 'drizzle-orm/pg-core'

import { auth } from './auth.js'
import { products, variants } from './product.js'
import { carts } from './cart.js'

export const orders = pgTable('orders', {
  id: uuid().defaultRandom().primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => auth.id, { onDelete: 'set null' }),
  subtotal: integer('subtotal').notNull(),
  shippingCost: integer('shipping_cost').notNull().default(0),
  shippingNumber: varchar('shipping_number', { length: 100 }),
  discount: integer('discount').notNull().default(0),
  grandTotal: integer('grand_total').notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const orderItems = pgTable('order_items', {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => variants.id),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const orderAddress = pgTable('order_address', {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  recipientName: varchar('recipient_name', { length: 150 }).notNull(),
  phone: varchar('phone', { length: 30 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  provinceName: varchar('province_name', { length: 100 }),
  cityName: varchar('city_name', { length: 100 }),
  districtName: varchar('district_name', { length: 100 }),
  subdistrictName: varchar('subdistrict_name', { length: 100 }),
  postalCode: varchar('postal_code', { length: 10 }),
  destinationId: integer('destination_id'),
  latitude: varchar('latitude', { length: 100 }),
  longitude: varchar('longitude', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const orderShipping = pgTable('order_shipping', {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  shipping: varchar('shipping', { length: 20 }).notNull(),
  shippingType: varchar('shipping_type', { length: 255 }).notNull(),
  shippingCost: integer('shipping_cost').notNull(),
  shippingCashback: integer('shipping_cashback').notNull(),
  serviceFee: integer('service_fee').notNull(),
  additionalCost: integer('additional_cost').notNull(),
  grandTotal: integer('grand_total').notNull(),
  codValue: integer('cod_value').notNull(),
  insuranceValue: integer('insurance_value').notNull(),
  notes: text('notes')
})