import { NextResponse } from 'next/server'
import { query } from '@aiva/database'
import { createSessionToken, DEFAULT_LOCAL_USER } from '../../../../../lib/auth/session'

export async function POST(req: Request) {
  try {
    const authMode = process.env.AIVA_AUTH_MODE || 'local'
    const body = await req.json().catch(() => ({}))
    const { email } = body

    let user = DEFAULT_LOCAL_USER

    if (authMode !== 'local' && email) {
      const userRes = await query('SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1', [email])
      if (userRes.rows.length > 0) {
        user = {
          id: userRes.rows[0].id,
          email: userRes.rows[0].email,
        }
      } else {
        // Create user in auth.users if registering
        const newUserRes = await query(
          'INSERT INTO auth.users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email',
          [email]
        )
        user = {
          id: newUserRes.rows[0].id,
          email: newUserRes.rows[0].email,
        }
      }
    }

    const token = createSessionToken(user)
    const response = NextResponse.json({
      status: 'success',
      message: 'Authentication successful',
      user,
    })

    // Set secure HTTP-only session cookie
    response.cookies.set('aiva_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return response
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message || 'Login failed' },
      { status: 500 }
    )
  }
}
