import { pgTable, varchar, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const auth = pgTable('auth', {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
})

export const user = pgTable("user", {
  id: uuid().defaultRandom().primaryKey(),
  authId: uuid('auth_id').notNull().references(() => auth.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  photo: varchar('photo', { length: 1000 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const refreshToken = pgTable('refresh_token', {
  id: uuid().defaultRandom().primaryKey(),
  authId: uuid('auth_id').notNull().references(() => auth.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 1000 }).notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }) .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})