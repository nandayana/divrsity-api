import { db } from "../../../db/index.js";
import { categories, products, productImages } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq, and, exists } from "drizzle-orm";

function parseDate (value) {
  if (
    value == null ||
    value === '' ||
    value === 'null' ||
    value === 'undefined'
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw { code: 400, message: `Invalid date: ${value}` };
  }

  return date;
};

class Product {

  createProduct = async (req, res) => {
    try {
      const { name, basePrice, categoryId, description, discountPercent, openOrderAt, closeOrderAt, isActive } = req.body;
      console.log('BODY = ', req.body)
      console.log('IS UUID = ', isValidUuid(categoryId))
      if (!name || !basePrice || !isValidUuid(categoryId)) throw { code: 400, message: "Invalid request data" };

      const [isCategory] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
      if (!isCategory) throw { code: 404, message: "Category not found" };

      const [result] = await db.insert(products).values({
        name, 
        description, 
        basePrice, 
        categoryId, 
        openOrderAt: parseDate(openOrderAt), 
        closeOrderAt: parseDate(closeOrderAt), 
        isActive,
        discountPercent: discountPercent || 0,

      }).returning();

      return res.status(201).json({ status: true, message: 'Created successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  getProducts = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 20);
      const offset = (page - 1) * limit;

      const { category, slug } = req.query;

      let whereCondition;

      if (slug) {
        whereCondition = exists(
          db
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.id, products.categoryId),
                eq(categories.slug, slug)
              )
            )
        );
      } else if (category) {
        whereCondition = eq(products.categoryId, category);
      }

      const [results, totalItems] = await Promise.all([
        db.query.products.findMany({
          limit,
          offset,
          where: whereCondition,
          with: {
            images: true,
            category: true,
            variants: true
          },
          orderBy: (products, { desc }) => [
            desc(products.createdAt)
          ]
        }),
        db.$count(products, whereCondition)
      ]);

      const data = results.map(product => ({
        ...product,
        isOutOfStock:
          product.variants.length > 0 &&
          product.variants.every(variant => variant.stock - variant.reservedStock <= 0)
      }));

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
        data
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
  
  getActiveProducts = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 20);
      const offset = (page - 1) * limit;

      const { category, slug } = req.query;

      console.log('SLUG = ', slug)

      let whereCondition;

      if (slug) {
        whereCondition = exists(
          db
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.id, products.categoryId),
                eq(categories.slug, slug),
                eq(categories.isActive, true)
              )
            )
        );
      } else if (category) {
        whereCondition = eq(products.categoryId, category)
      } else {
        whereCondition = exists(
          db
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.id, products.categoryId),
                eq(categories.isActive, true)
              )
            )
        );
      }

      whereCondition = and(
        whereCondition,
        eq(products.isActive, true)
      );

      const [results, totalItems] = await Promise.all([
        db.query.products.findMany({
          limit,
          offset,
          where: whereCondition,
          with: {
            images: true,
            category: true,
            variants: true
          },
          orderBy: (products, { desc }) => [
            desc(products.createdAt)
          ]
        }),
        db.$count(products, whereCondition)
      ]);

      const data = results.map(product => ({
        ...product,
        isOutOfStock:
          product.variants.length > 0 &&
          product.variants.every(variant => variant.stock - variant.reservedStock <= 0)
      }));

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
        data
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  getProductById = async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Product ID format" };

      const result = await db.query.products.findFirst({
        where: (products, { eq }) => eq(products.id, id),
        with: {
          category: true,
          images: {
            with: { color: true }
          },
          variants: {
            with: {
              color: true,
              size: true
            }
          }
        }
      });

      if (!result) throw { code: 404, message: "Product not found" };

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        data: result
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  updateProduct = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Product not found" };
      console.log('BODY ASEM = ', req.body.discountPercent)
      console.log('BODY ASEM = ', req.body)
      const body = {};
      if (req.body.name) body.name = req.body.name;
      if (req.body.description !== undefined) body.description = req.body.description;
      if (req.body.basePrice) body.basePrice = req.body.basePrice;
      if (req.body.isActive) body.isActive = req.body.isActive;
      if (req.body.discountPercent !== undefined) body.discountPercent = req.body.discountPercent;
      if (req.body.closeOrderAt !== undefined) body.closeOrderAt = parseDate(req.body.closeOrderAt)
      if (req.body.openOrderAt !== undefined) body.openOrderAt = parseDate(req.body.openOrderAt)

      if (req.body.categoryId) {
        if (!isValidUuid(req.body.categoryId)) throw { code: 400, message: "Invalid Category ID format" };
        const [isCategory] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, req.body.categoryId)).limit(1);
        if (!isCategory) throw { code: 404, message: "Target Category not found" };
        body.categoryId = req.body.categoryId;
      }

      console.log('BODY = ', body)

      const [result] = await db.update(products).set(body).where(eq(products.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Product updated successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  deleteProduct = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Product not found" };

      const relatedImages = await db.select({ image: productImages.image }).from(productImages).where(eq(productImages.productId, id));
      relatedImages.forEach(img => deleteFile(img.image));

      await db.delete(products).where(eq(products.id, id));
      return res.status(200).json({ status: true, message: "Product and all related images deleted successfully" });
    } catch (error) {
      return handleError(res, error);
    }
  }

  deleteManyProduct = async (req, res) => {
    try {
      // 1. Ambil array ID dari req.body
      const { ids } = req.body;

      // Validasi pastikan input berbentuk array dan tidak kosong
      if (!Array.isArray(ids) || ids.length === 0) {
        throw { code: 400, message: "ID harus berupa array dan tidak boleh kosong" };
      }

      // 2. Ambil data kategori yang akan dihapus untuk keperluan hapus file gambar
      const existingData = await db
        .select()
        .from(products)
        .where(inArray(products.id, ids));

      if (existingData.length === 0) {
        throw { code: 404, message: "Kategori tidak ditemukan" };
      }

      // 3. Loop untuk menghapus file gambar fisik dari server
      existingData.forEach((item) => {
        if (item.image) {
          deleteFile(item.image);
        }
      });

      // 4. Eksekusi penghapusan massal di database menggunakan inArray
      await db
        .delete(products)
        .where(inArray(products.id, ids));

      return res.status(200).json({
        status: true,
        message: `${existingData.length} Kategori berhasil dihapus`
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new Product()