import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  timestamp, uuid
} from 'drizzle-orm/pg-core'

import { orders } from './order.js'

export const shipping = pgTable('shipping', {
  id: uuid().defaultRandom().primaryKey(),
  shippingId: varchar('shipping_id', { length: 255 }).notNull().unique(),
  shippingNo: varchar('shipping_no', { length: 255 }).unique(),
  awb: varchar('awb', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})