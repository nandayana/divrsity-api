import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auth, user, refreshToken } from '../../db/schema/index.js'
import { OAuth2Client } from 'google-auth-library'
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, verifyAccessToken } from '../../utils/jwt.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage'
)

export async function googleLogin(req, res) {
  try {

    // ==========================================
    // 1. Ambil authorization code dari frontend
    // ==========================================

    const { code } = req.body

    if (!code) {
      return res.status(400).json({
        message: 'Google authorization code is required'
      })
    }


    // ==========================================
    // 2. Tukarkan code ke Google
    // ==========================================

    const { tokens } = await googleClient.getToken(code)

    if (!tokens.id_token) {
      return res.status(401).json({
        message: 'Google ID token is unavailable'
      })
    }


    // ==========================================
    // 3. Verify ID token
    // ==========================================

    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()

    if (!payload) {
      return res.status(401).json({
        message: 'Invalid Google token'
      })
    }


    // ==========================================
    // 4. Ambil data Google
    // ==========================================

    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      photo: payload.picture,
      emailVerified: payload.email_verified
    }


    if (!googleUser.email) {
      return res.status(400).json({
        message: 'Google account email is unavailable'
      })
    }


    if (!googleUser.emailVerified) {
      return res.status(400).json({
        message: 'Google email is not verified'
      })
    }


    // ==========================================
    // 5. Cari auth berdasarkan email
    // ==========================================

    let existingAuth = await db.query.auth.findFirst({
      where: eq(auth.email, googleUser.email)
    })

    let authId
    let userId


    // ==========================================
    // 6. Kalau belum ada auth
    // ==========================================

    if (!existingAuth) {

      const [newAuth] = await db
        .insert(auth)
        .values({
          email: googleUser.email,
          password: null
        })
        .returning()

      authId = newAuth.id


      // Buat user
      const [newUser] = await db
        .insert(user)
        .values({
          authId: newAuth.id,
          name: googleUser.name,
          photo: googleUser.photo
        })
        .returning()

      userId = newUser.id

    } else {

      // ==========================================
      // 7. Auth sudah ada
      // ==========================================

      authId = existingAuth.id


      // Cari profile
      const existingUser = await db.query.user.findFirst({
        where: eq(user.authId, existingAuth.id)
      })


      if (!existingUser) {

        // ==========================================
        // 8. Auth ada tapi user belum ada
        // ==========================================

        const [newUser] = await db
          .insert(user)
          .values({
            authId: existingAuth.id,
            name: googleUser.name,
            photo: googleUser.photo
          })
          .returning()

        userId = newUser.id

      } else {

        // ==========================================
        // 9. User sudah ada
        // ==========================================

        userId = existingUser.id


        // Update data Google
        await db
          .update(user)
          .set({
            name: googleUser.name,
            photo: googleUser.photo,
            updatedAt: new Date()
          })
          .where(eq(user.id, existingUser.id))
      }
    }


    // ==========================================
    // 10. Generate JWT
    // ==========================================

    const jwtPayload = {
      id: authId
    }


    const accessTokenJwt =
      generateAccessToken(jwtPayload)

    const refreshTokenJwt =
      generateRefreshToken(jwtPayload)


    // ==========================================
    // 11. Refresh token expiration
    // ==========================================

    const refreshTokenExpiredAt =
      new Date(
        Date.now() +
        Number(
          process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME
        )
      )


    // ==========================================
    // 12. Simpan refresh token
    // ==========================================

    await db
      .insert(refreshToken)
      .values({
        authId,
        token: refreshTokenJwt,
        expiredAt: refreshTokenExpiredAt
      })


    // ==========================================
    // 13. Access token cookie
    // ==========================================

    res.cookie(
      'access_token',
      accessTokenJwt,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV === 'production',

        sameSite:
          process.env.NODE_ENV === 'production'
            ? 'none'
            : 'lax',

        maxAge: Number(
          process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME
        )
      }
    )


    // ==========================================
    // 14. Refresh token cookie
    // ==========================================

    res.cookie(
      'refresh_token',
      refreshTokenJwt,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV === 'production',

        sameSite:
          process.env.NODE_ENV === 'production'
            ? 'none'
            : 'lax',

        maxAge: Number(
          process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME
        )
      }
    )


    // ==========================================
    // 15. Response
    // ==========================================

    return res.status(200).json({
      message: 'Google login successful',

      data: {
        id: userId,
        email: googleUser.email,
        name: googleUser.name,
        photo: googleUser.photo
      }
    })

  } catch (error) {
    console.error('GOOGLE LOGIN ERROR:', error)

    return res.status(401).json({
      message: 'Google authentication failed'
    })
  }
}

export async function getProfile(req, res) {
  try {

    const authId = req.user?.id

    if (!authId) {
      return res.status(401).json({
        message: 'Invalid authentication data'
      })
    }


    // Cari auth
    const existingAuth = await db.query.auth.findFirst({
      where: eq(auth.id, authId)
    })

    if (!existingAuth) {
      return res.status(404).json({
        message: 'User account not found'
      })
    }


    // Cari profile user
    const existingUser = await db.query.user.findFirst({
      where: eq(user.authId, authId)
    })

    if (!existingUser) {
      return res.status(404).json({
        message: 'User profile not found'
      })
    }


    return res.status(200).json({
      message: 'Profile retrieved successfully',

      data: {
        id: existingUser.id,
        email: existingAuth.email,
        name: existingUser.name,
        photo: existingUser.photo
      }
    })

  } catch (error) {

    console.error('GET PROFILE ERROR:', error)

    return res.status(500).json({
      message: 'Failed to get profile'
    })
  }
}

export async function refreshAccessToken(req, res) {
  try {

    const refreshTokenJwt =
      req.cookies?.refresh_token

    if (!refreshTokenJwt) {
      return res.status(401).json({
        message: 'Refresh token is required'
      })
    }


    // 1. Verify JWT refresh token
    let payload

    try {
      payload = verifyRefreshToken(refreshTokenJwt)
    } catch (error) {
      return res.status(401).json({
        message: 'Invalid or expired refresh token'
      })
    }


    const authId = payload.id

    if (!authId) {
      return res.status(401).json({
        message: 'Invalid refresh token payload'
      })
    }


    // 2. Cari refresh token di database
    const existingToken =
      await db.query.refreshToken.findFirst({
        where: and(
          eq(refreshToken.token, refreshTokenJwt),
          eq(refreshToken.authId, authId)
        )
      })


    if (!existingToken) {
      return res.status(401).json({
        message: 'Refresh token not found'
      })
    }


    // 3. Cek expiration database
    if (
      new Date(existingToken.expiredAt) <= new Date()
    ) {

      // optional: hapus token expired
      await db
        .delete(refreshToken)
        .where(
          eq(
            refreshToken.id,
            existingToken.id
          )
        )

      return res.status(401).json({
        message: 'Refresh token expired'
      })
    }


    // 4. Generate access token baru
    const newAccessToken =
      generateAccessToken({
        id: authId
      })


    // 5. Simpan access token di cookie
    res.cookie(
      'access_token',
      newAccessToken,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV === 'production',

        sameSite:
          process.env.NODE_ENV === 'production'
            ? 'none'
            : 'lax',

        maxAge: Number(
          process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME
        )
      }
    )


    return res.status(200).json({
      message: 'Access token refreshed'
    })

  } catch (error) {

    console.error(
      'REFRESH TOKEN ERROR:',
      error
    )

    return res.status(500).json({
      message: 'Failed to refresh access token'
    })
  }
}

function hashPassword(password) {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword)
}

export async function register(req, res) {
  try {
    const { email, password } = req.body

    console.log('REGISTER REQUEST BODY:', req.body)

    // Check if user already exists
    const existingUser = await db.query.auth.findFirst({
      where: eq(auth.email, email)
    })

    console.log('EXISTING USER:', existingUser)

    let newUser = null

    if (existingUser) {
      newUser = await db.update(auth).set({
        password: await hashPassword(password),
        isAdmin: true,
      }).where(eq(auth.id, existingUser.id)).returning()
      console.log('NEW USER:', newUser)
    } else {
      // Create new user
      newUser = await db.insert(auth).values({
        email,
        password: await hashPassword(password)
      }).returning()
    }

    return res.status(201).json({
      message: 'User created successfully',
      user: newUser[0]
    })

  } catch (error) {
    console.error('REGISTER ERROR:', error)
    return res.status(500).json({
      message: 'Failed to register user'
    })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    console.log('LOGIN REQUEST BODY:', req.body)

    if (!email || !password) {
      return res.status(422).json({
        message: 'Email and password are required'
      })
    }

    const existingUser = await db.query.auth.findFirst({
      where: eq(auth.email, email.toLowerCase().trim())
    })

    if (!existingUser) {
      return res.status(401).json({
        message: 'Invalid email or password'
      })
    }

    const passwordValid = await comparePassword(
      password,
      existingUser.password
    )

    if (!passwordValid) {
      return res.status(401).json({
        message: 'Invalid email or password'
      })
    }

    const accessTokenExpiration = Number(
      process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME
    )

    const refreshTokenExpiration = Number(
      process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME
    )

    const accessToken = generateAccessToken({
        id: existingUser.id
      })

    const refreshTokenJwt = generateRefreshToken({
        id: existingUser.id
      })

    await db.insert(refreshToken).values({
      authId: existingUser.id,
      token: refreshTokenJwt,
      expiredAt: new Date(Date.now() + refreshTokenExpiration)
    })

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: accessTokenExpiration
    })

    res.cookie('refresh_token', refreshTokenJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: refreshTokenExpiration
    })

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: existingUser.id,
        email: existingUser.email,
        isAdmin: existingUser.isAdmin
      }
    })

  } catch (error) {
    console.error('LOGIN ERROR:', error)

    return res.status(500).json({
      message: 'Failed to login'
    })
  }
}