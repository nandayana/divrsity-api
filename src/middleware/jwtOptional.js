import jwt from 'jsonwebtoken'

export function jwtOptional(req, res, next) {
  try {
    const accessToken = req.cookies?.access_token

    if (!accessToken) {
      req.user = null
      return next()
    }

    const payload = jwt.verify(
      accessToken,
      process.env.JWT_ACCESS_SECRET
    )

    req.user = payload

    next()

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      req.user = null
      return next()
    }

    if (error.name === 'JsonWebTokenError') {
      req.user = null
      return next()
    }

    return res.status(401).json({
      message: 'Authentication failed'
    })
  }
}