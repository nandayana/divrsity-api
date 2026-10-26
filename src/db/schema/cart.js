import { auth } from './auth.js';
import { pgTable, uuid, varchar, timestamp, uniqueIndex, unique, integer } from 'drizzle-orm/pg-core';
import { variants } from './product.js';

export const carts = pgTable('carts', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => auth.id, { onDelete: 'set null' }),
  tokenHash: varchar('token_hash', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
},
  (table) => ({ tokenHashIdx: uniqueIndex('carts_token_hash_idx').on(table.tokenHash) })
);

export const cartItems = pgTable('cart_items', {
  id: uuid().defaultRandom().primaryKey(),
  cartId: uuid('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => variants.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
},
  (table) => ({ cartVariantUnique: unique().on(table.cartId, table.variantId) })
);