import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, signSessionToken, createSessionCookieHeader } from '@/lib/auth';
import { recordAuditLog } from '@/services/audit.service';
import { AuthSession } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { email, password, loginType } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email and password are required.' } },
        { status: 400 }
      );
    }

    // 1. Check Platform User first if loginType is platform or not specified
    if (loginType === 'platform' || !loginType) {
      const platformUser = await db.platformUser.findUnique({
        where: { email },
      });

      if (platformUser && (await verifyPassword(password, platformUser.passwordHash))) {
        const session: AuthSession = {
          userId: platformUser.id,
          email: platformUser.email,
          name: platformUser.name,
          isPlatformUser: true,
          platformRole: platformUser.role as any,
        };

        const token = signSessionToken(session);

        await recordAuditLog({
          actorId: platformUser.id,
          actorEmail: platformUser.email,
          actorType: 'PLATFORM_USER',
          action: 'PLATFORM_LOGIN_SUCCESS',
          resource: 'auth',
        });

        const res = NextResponse.json({
          success: true,
          data: { session, redirectUrl: '/admin' },
        });

        res.headers.set('Set-Cookie', createSessionCookieHeader(token));
        return res;
      }
    }

    // 2. Check Tenant User
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            tenant: true,
          },
          take: 1,
        },
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } },
        { status: 401 }
      );
    }

    const membership = user.memberships[0];
    if (!membership) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TENANT_ASSIGNED', message: 'User does not belong to any active organization.' } },
        { status: 403 }
      );
    }

    const session: AuthSession = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isPlatformUser: false,
      tenantId: membership.tenantId,
      tenantName: membership.tenant.name,
      tenantRole: membership.role as any,
    };

    const token = signSessionToken(session);

    await recordAuditLog({
      tenantId: membership.tenantId,
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'TENANT_MEMBER',
      action: 'TENANT_LOGIN_SUCCESS',
      resource: 'auth',
    });

    const res = NextResponse.json({
      success: true,
      data: { session, redirectUrl: '/app' },
    });

    res.headers.set('Set-Cookie', createSessionCookieHeader(token));
    return res;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error.' } },
      { status: 500 }
    );
  }
}
