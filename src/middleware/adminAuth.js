import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auth } from '../db/schema/index.js'

export async function adminAuth(req, res, next) {

  try {
    if (!req.user?.id) {
      return res.status(401).json({
        message: 'Authentication required'
      })
    }

    const [user] = await db
      .select({
        id: auth.id,
        email: auth.email,
        isAdmin: auth.isAdmin
      })
      .from(auth)
      .where(eq(auth.id, req.user.id))
      .limit(1)

    if (!user) {
      return res.status(401).json({
        message: 'User not found'
      })
    }

    if (user.isAdmin !== true) {
      return res.status(403).json({
        message: 'Admin access required'
      })
    }

    req.user = {
      ...req.user,
      isAdmin: user.isAdmin
    }

    next()

  } catch (error) {

    console.error('ADMIN AUTH ERROR:', error)

    return res.status(500).json({
      message: 'Authentication failed'
    })
  }
}