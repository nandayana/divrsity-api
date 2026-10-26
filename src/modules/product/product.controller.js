import { db } from "../../db/index.js";
import { categories, products } from "../../db/schema/index.js";
import { deleteFile, handleError, isValidUuid } from "../../utils/helper.js";
import { desc, eq } from "drizzle-orm";

class WebApp {

  getCategories = async (req, res) => {
    try {
      const results = await db.query.categories.findMany({
        where: eq(categories.isActive, true),
        orderBy: [desc(categories.createdAt)],
        limit: 3,
      })

      return res.status(200).json({
        status: true,
        message: 'Load successfully',
        data: results
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  getProducts = async (req, res) => {
    try {
      const results = await db.query.products.findMany({
        with: {
          images: true,
          variants: {
            with: {
              color: true,
              size: true
            }
          }
        }
      });
      return res.status(200).json({ status: true, message: 'Load successfully', data: results });
    } catch (error) {
      return handleError(res, error);
    }
  }

}

export default new WebApp()