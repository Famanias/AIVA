import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../../../lib/auth/session';

export async function GET(req: Request) {
  try {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ status: 'unauthorized', user: null }, { status: 401 });
    }

    return NextResponse.json({
      status: 'success',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message || 'Failed to get session' },
      { status: 500 }
    );
  }
}
