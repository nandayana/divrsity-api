import { db } from "../../../db/index.js";
import { products, productImages } from "../../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../../utils/helper.js";
import { eq } from "drizzle-orm";

class ProductImage {

  createProductImage = async (req, res) => {
    try {
      const { productId, colorId, isPrimary } = req.body;
      if (!isValidUuid(productId) || !req.file || (colorId && !isValidUuid(colorId))) {
        throw { code: 400, message: "Invalid request fields or missing file" };
      }

      const [isProduct] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
      if (!isProduct) throw { code: 404, message: "Product target not found" };

      const image = `/${process.env.MEDIA_URL}/${req.file.filename}`;
      const [result] = await db.insert(productImages).values({
        productId, image,
        colorId: colorId || null,
        isPrimary: isPrimary === 'true' || isPrimary === true
      }).returning();

      return res.status(201).json({ status: true, message: 'Image added successfully', data: result });
    } catch (error) {
      return handleError(res, error, req.file);
    }
  }

  getProductImages = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.max(1, parseInt(req.query.rows) || 10);
      const offset = (page - 1) * limit;

      const [results, totalItems] = await Promise.all([
        db.query.productImages.findMany({
          limit: limit,
          offset: offset,
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
            color: true
          }
        }),
        db.$count(productImages)
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

  getImageById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidUuid(id)) throw { code: 400, message: "Invalid Image ID format" };

      const result = await db.query.productImages.findFirst({
        where: (productImages, { eq }) => eq(productImages.id, id),
        with: {
          product: true,
        }
      });

      if (!result) throw { code: 404, message: "Image not found" };
      return res.status(200).json({ status: true, message: 'Load successfully', data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  updateProductImage = async (req, res) => {
    try {
      const { id } = req.params;

      const [existing] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, id))
        .limit(1);

      if (!existing) {
        throw { code: 404, message: 'Product Image not found' };
      }

      const body = {};

      if (req.body.productId !== undefined) {
        body.productId = req.body.productId || null;
      }

      if (req.body.image !== undefined) {
        body.image = req.body.image || null;
      }

      if (req.file) {
        body.image = `/${process.env.MEDIA_URL}/${req.file.filename}`;
      }

      const [result] = await db
        .update(productImages)
        .set(body)
        .where(eq(productImages.id, id))
        .returning();

      if (req.file && existing.image) {
        deleteFile(existing.image);
      }

      return res.status(200).json({
        status: true,
        message: 'Product image updated successfully',
        data: result
      });
    } catch (error) {
      return handleError(res, error, req.file);
    }
  };

  deleteProductImage = async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(productImages).where(eq(productImages.id, id)).limit(1);
      if (!existing) throw { code: 404, message: "Product Image not found" };

      deleteFile(existing.image); // Hapus file fisiknya

      await db.delete(productImages).where(eq(productImages.id, id)); // Hapus record di DB

      return res.status(200).json({ status: true, message: "Product image deleted successfully" });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new ProductImage()