import { db } from "../../../db/index.js";
import { variants, products, colors, sizes } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq } from "drizzle-orm";

class Variant {
    // ==========================================
  // METODE API VARIANTS (Kombinasi Stok Produk)
  // ==========================================

  // 1. CREATE VARIANT: Membuat kombinasi warna, ukuran, SKU, dan stok untuk produk
  createVariant = async (req, res) => {
    try {
      const { productId, colorId, sizeId, sku, stock, priceOverride } = req.body;

      // Validasi input wajib menggunakan helper isValidUuid langsung
      if (!sku || stock === undefined || !isValidUuid(productId) || !isValidUuid(colorId) || !isValidUuid(sizeId)) {
        throw { code: 400, message: "Data tidak lengkap atau format ID salah" };
      }

      // Validasi apakah produk, warna, dan ukuran benar-benar ada di database
      const [isProduct] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
      if (!isProduct) throw { code: 404, message: "Product target tidak ditemukan" };

      const [isColor] = await db.select({ id: colors.id }).from(colors).where(eq(colors.id, colorId)).limit(1);
      if (!isColor) throw { code: 404, message: "Warna tidak ditemukan" };

      const [isSize] = await db.select({ id: sizes.id }).from(sizes).where(eq(sizes.id, sizeId)).limit(1);
      if (!isSize) throw { code: 404, message: "Ukuran tidak ditemukan" };

      // Eksekusi insert data varian
      const [result] = await db.insert(variants).values({
        productId,
        colorId,
        sizeId,
        sku,
        stock: Number(stock),
        priceOverride: priceOverride ? String(priceOverride) : null
      }).returning();

      return res.status(201).json({ status: true, message: 'Variant created successfully', data: result });
    } catch (error) {
      // Jika terjadi error code 23505 di postgres (SKU duplikat), otomatis kirim bad request
      if (error.code === '23505') {
        return res.status(400).json({ status: false, message: "SKU tersebut sudah digunakan oleh varian lain." });
      }
      return handleError(res, error); // Menggunakan global helper
    }
  }

  // 2. READ ALL VARIANTS: Mengambil semua varian beserta detail produk, warna, dan ukuran masternya
  getVariants = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 10);
      const offset = (page - 1) * limit;

      const [results, totalItems] = await Promise.all([
        db.query.variants.findMany({
          limit: limit,
          offset: offset,
          orderBy: (variants, { desc }) => [desc(variants.sku)],
          with: {
            product: { 
              columns: { 
                name: true, 
                basePrice: true
              },
              with: {
                category: {
                  columns: {
                    id: true,
                    name: true // Hanya mengambil kolom id dan name saja
                  }
                }
              },
            },
            color: true,
            size: true
          }
        }),
        db.$count(variants)
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
        },
        data: results
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // 3. READ SINGLE VARIANT BY ID: Mengambil detail satu varian spesifik
  getVariantById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Variant ID format" };

      const result = await db.query.variants.findFirst({
        where: (variants, { eq }) => eq(variants.id, id),
        with: {
          product: { 
            columns: { 
              name: true, 
              basePrice: true 
            } 
          },
          color: true,
          size: true
        }
      });

      if (!result) throw { code: 404, message: "Variant not found" };
      return res.status(200).json({ status: true, message: 'Load successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // 4. UPDATE VARIANT: Mengubah stok, SKU, harga override, atau memindahkan relasi atribut
  updateVariant = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Variant ID format" };

      const [existing] = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Variant not found" };

      const body = {};
      if (req.body.sku) body.sku = req.body.sku;
      if (req.body.stock !== undefined) body.stock = Number(req.body.stock);
      if (req.body.priceOverride !== undefined) body.priceOverride = req.body.priceOverride ? String(req.body.priceOverride) : null;

      // Jika user ingin mengubah warna varian
      if (req.body.colorId) {
        if (!isValidUuid(req.body.colorId)) throw { code: 400, message: "Invalid Color ID format" };
        const [isColor] = await db.select({ id: colors.id }).from(colors).where(eq(colors.id, req.body.colorId)).limit(1);
        if (!isColor) throw { code: 404, message: "Target Color not found" };
        body.colorId = req.body.colorId;
      }

      // Jika user ingin mengubah ukuran varian
      if (req.body.sizeId) {
        if (!isValidUuid(req.body.sizeId)) throw { code: 400, message: "Invalid Size ID format" };
        const [isSize] = await db.select({ id: sizes.id }).from(sizes).where(eq(sizes.id, req.body.sizeId)).limit(1);
        if (!isSize) throw { code: 404, message: "Target Size not found" };
        body.sizeId = req.body.sizeId;
      }

      const [result] = await db.update(variants).set(body).where(eq(variants.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Variant updated successfully', data: result });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ status: false, message: "SKU tersebut sudah digunakan oleh varian lain." });
      }
      return handleError(res, error);
    }
  }

  // 5. DELETE VARIANT: Menghapus data varian produk
  deleteVariant = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Variant ID format" };

      const [existing] = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Variant not found" };

      await db.delete(variants).where(eq(variants.id, id));
      return res.status(200).json({ status: true, message: "Variant deleted successfully" });
    } catch (error) {
      return handleError(res, error);
    }
  }

}

export default new Variant()