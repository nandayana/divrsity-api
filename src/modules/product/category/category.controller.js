import { db } from "../../../db/index.js";
import { categories } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq, inArray } from "drizzle-orm";

class Category {

  createCategory = async (req, res) => {
    try {
      const image = req.file ? `/${process.env.MEDIA_URL}/${req.file.filename}` : null;
      const [result] = await db.insert(categories).values({
        name: req.body.name,
        description: req.body.description,
        slug: req.body.slug,
        image
      }).returning();

      if (!result) throw { code: 400, message: "Invalid data" };
      return res.status(201).json({ status: true, message: 'Created successfully', data: result });
    } catch (error) {
      return handleError(res, error, req.file);
    }
  }

  getCategories = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 10);
      const offset = (page - 1) * limit;

      const [results, totalItems] = await Promise.all([
        db.query.categories.findMany({
          limit: limit,
          offset: offset
        }),
        db.$count(categories)
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

  getCategoryById = async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Product ID format" };

      const result = await db.query.categories.findFirst({
        where: (categories, { eq }) => eq(categories.id, id)
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

  updateCategory = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Invalid request" };

      const body = {};
      if (req.body.name) body.name = req.body.name;
      if (req.body.slug) body.slug = req.body.slug;
      if (req.body.isActive) body.isActive = req.body.isActive;
      if (req.body.description !== undefined) body.description = req.body.description;

      if (req.file) {
        body.image = `/${process.env.MEDIA_URL}/${req.file.filename}`;
        deleteFile(existing.image);
      }

      const [result] = await db.update(categories).set(body).where(eq(categories.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Updated successfully', data: result });
    } catch (error) {
      return handleError(res, error, req.file);
    }
  }

  deleteCategory = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Kategori tidak ditemukan" };

      deleteFile(existing.image);
      await db.delete(categories).where(eq(categories.id, id));

      return res.status(200).json({ status: true, message: "Kategori berhasil dihapus" });
    } catch (error) {
      return handleError(res, error);
    }
  }

  deleteManyCategory = async (req, res) => {
    try {
      // 1. Ambil array ID dari req.body
      const { ids } = req.body;

      // Validasi pastikan input berbentuk array dan tidak kosong
      if (!Array.isArray(ids) || ids.length === 0) {
        throw { code: 400, message: "ID harus berupa array dan tidak boleh kosong" };
      }

      // 2. Ambil data kategori yang akan dihapus untuk keperluan hapus file gambar
      const existingCategories = await db
        .select()
        .from(categories)
        .where(inArray(categories.id, ids));

      if (existingCategories.length === 0) {
        throw { code: 404, message: "Kategori tidak ditemukan" };
      }

      // 3. Loop untuk menghapus file gambar fisik dari server
      existingCategories.forEach((category) => {
        if (category.image) {
          deleteFile(category.image);
        }
      });

      // 4. Eksekusi penghapusan massal di database menggunakan inArray
      await db
        .delete(categories)
        .where(inArray(categories.id, ids));

      return res.status(200).json({
        status: true,
        message: `${existingCategories.length} Kategori berhasil dihapus`
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new Category()