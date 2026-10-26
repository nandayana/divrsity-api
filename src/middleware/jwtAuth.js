import jwt from 'jsonwebtoken'

export function jwtAuth(req, res, next) {
  try {
    const accessToken = req.cookies?.access_token

    if (!accessToken) {
      if (['/api/cart/item', '/api/cart'].includes(req.originalUrl)) {
        return next()
      } else {
        return res.status(401).json({
          message: 'Access token is required'
        })
      }
    }

    const payload = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET
    )

    // Simpan payload JWT ke request
    req.user = payload

    next()

  } catch (error) {

    console.error('JWT AUTH ERROR:', error)

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Access token has expired'
      })
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Invalid access token'
      })
    }

    return res.status(401).json({
      message: 'Authentication failed'
    })
  }
}