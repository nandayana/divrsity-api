import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  integer,
  timestamp, uuid, text,
  unique
} from 'drizzle-orm/pg-core'

import { orders } from './order.js'

export const payments = pgTable('payments', {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  paymentId: text('payment_id').notNull(),
  paymentUrl: text('payment_url').notNull(),
  vaNumber: text('va_number'),
  bankCode: varchar('bank_code', { length: 16 }),
  bankName: varchar('bank_name', { length: 255 }),
  paymentType: varchar('payment_type', { length: 16 }),
  qrString: text('qr_string'),
  amount: integer('amount').notNull(),
  image: varchar('image', { length: 500 }),
  status: varchar('status', { length: 128 }).notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (table) => [
  unique('payments_payment_id_unique_idx').on(table.paymentId)
])