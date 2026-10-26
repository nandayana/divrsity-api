import { OAuth2Client } from 'google-auth-library'

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
)

export async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  })

  const payload = ticket.getPayload()

  if (!payload) {
    throw new Error('Invalid Google token')
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    photo: payload.picture
  }
}