import { db } from "../../../db/index.js";
import { sizes } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq } from "drizzle-orm";

class Size {
  createSize = async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) throw { code: 400, message: "Nama warna wajib diisi" };

      const [result] = await db.insert(sizes).values({
        name,
        description: description || null
      }).returning();

      return res.status(201).json({ status: true, message: 'Size created successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  getSizes = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 10);
      const offset = (page - 1) * limit;

      const [results, totalItems] = await Promise.all([
        db.query.sizes.findMany({
          limit: limit,
          offset: offset
        }),
        db.$count(sizes)
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

  getSizeById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Size ID format" };

      const result = await db.query.sizes.findFirst({
        where: (sizes, { eq }) => eq(sizes.id, id)
      });

      if (!result) throw { code: 404, message: "Size not found" };
      return res.status(200).json({ status: true, message: 'Load successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  updateSize = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Size ID format" };

      const [existing] = await db.select().from(sizes).where(eq(sizes.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Size not found" };

      const body = {};
      if (req.body.name) body.name = req.body.name;
      if (req.body.description !== undefined) body.description = req.body.description || null;

      const [result] = await db.update(sizes).set(body).where(eq(sizes.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Size updated successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  deleteSize = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Size ID format" };

      const [existing] = await db.select().from(sizes).where(eq(sizes.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Size not found" };

      await db.delete(sizes).where(eq(sizes.id, id));
      return res.status(200).json({ status: true, message: "Size deleted successfully" });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new Size()