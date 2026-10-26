import { pgTable, serial, varchar, text, decimal, integer, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const categories = pgTable('categories', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 1. TABEL PRODUCTS (Master Data Produk)
// ==========================================
export const products = pgTable('products', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  basePrice: decimal('base_price', { precision: 12, scale: 2 }).notNull(),
  discountPercent: integer('discount_percent').default(0),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  openOrderAt: timestamp('open_order_at', { withTimezone: true }),
  closeOrderAt: timestamp('close_order_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
});

// ==========================================
// 2. TABEL COLORS (Master Data Warna)
// ==========================================
export const colors = pgTable('colors', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  hexCode: varchar('hex_code', { length: 10 }),
});

// ==========================================
// 3. TABEL SIZES (Master Data Ukuran)
// ==========================================
export const sizes = pgTable('sizes', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar('name', { length: 20 }).notNull(),
  description: varchar('description', { length: 200 })

});

// ==========================================
// 4. TABEL VARIANTS (Kombinasi Warna, Ukuran & Stok)
// ==========================================
export const variants = pgTable('variants', {
  id: uuid().defaultRandom().primaryKey(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  colorId: uuid('color_id').notNull().references(() => colors.id),
  sizeId: uuid('size_id').notNull().references(() => sizes.id),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  stock: integer('stock').default(0).notNull(),
  reservedStock: integer('reserved_stock').default(0).notNull(),
  priceOverride: decimal('price_override', { precision: 12, scale: 2 }), // Opsional jika harga beda per varian
});

// ==========================================
// 5. TABEL PRODUCT IMAGES (Galeri Foto)
// ==========================================
export const productImages = pgTable('product_images', {
  id: uuid().defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  colorId: uuid('color_id')
    .references(() => colors.id, { onDelete: 'set null' }), // Spesifik warna (opsional)
  image: varchar('image', { length: 500 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
});