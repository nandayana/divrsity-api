import { db } from "../../../db/index.js";
import { colors } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq, ilike } from "drizzle-orm";

class Color {
  createColor = async (req, res) => {
    try {
      const { name, hexCode } = req.body;
      if (!name) throw { code: 400, message: "Nama warna wajib diisi" };

      const [result] = await db.insert(colors).values({
        name,
        hexCode: hexCode || null
      }).returning();

      return res.status(201).json({ status: true, message: 'Color created successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  getColors = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 10);
      const offset = (page - 1) * limit;
      const { search } = req.query;

      const whereCondition = search
        ? ilike(colors.name, `%${search}%`)
        : undefined;

      const [results, totalItems] = await Promise.all([
        db.query.colors.findMany({
          limit,
          offset,
          where: whereCondition
        }),
        db.$count(colors, whereCondition)
      ]);

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
        data: results
      });
    } catch (error) {
      return handleError(res, error);
    }
  };

  getColorById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Color ID format" };

      const result = await db.query.colors.findFirst({
        where: (colors, { eq }) => eq(colors.id, id)
      });

      if (!result) throw { code: 404, message: "Color not found" };
      return res.status(200).json({ status: true, message: 'Load successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  updateColor = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Color ID format" };

      const [existing] = await db.select().from(colors).where(eq(colors.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Color not found" };

      const body = {};
      if (req.body.name) body.name = req.body.name;
      if (req.body.hexCode !== undefined) body.hexCode = req.body.hexCode || null;

      const [result] = await db.update(colors).set(body).where(eq(colors.id, id)).returning();
      return res.status(200).json({ status: true, message: 'Color updated successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  deleteColor = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Color ID format" };

      const [existing] = await db.select().from(colors).where(eq(colors.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Color not found" };

      await db.delete(colors).where(eq(colors.id, id));
      return res.status(200).json({ status: true, message: "Color deleted successfully" });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new Color()