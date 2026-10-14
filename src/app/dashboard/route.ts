import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session?.isPlatformUser && !session.tenantId) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  return NextResponse.redirect(new URL('/app', req.url));
}
