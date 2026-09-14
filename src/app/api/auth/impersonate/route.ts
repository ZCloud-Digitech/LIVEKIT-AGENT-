import { NextRequest, NextResponse } from 'next/server';
import { getSession, signSessionToken, createSessionCookieHeader } from '@/lib/auth';
import { assertPlatformAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { recordAuditLog } from '@/services/audit.service';
import { AuthSession } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const currentSession = await getSession();
    assertPlatformAccess(currentSession, ['SUPER_ADMIN', 'ADMIN']);

    const { tenantId } = await req.json();
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'tenantId is required.' } },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found.' } },
        { status: 404 }
      );
    }

    // Create impersonation session
    const impersonatedSession: AuthSession = {
      userId: currentSession!.userId,
      email: currentSession!.email,
      name: `${currentSession!.name} (Support Mode)`,
      isPlatformUser: true,
      platformRole: currentSession!.platformRole,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantRole: 'OWNER',
      isImpersonating: true,
      impersonatedBy: currentSession!.email,
    };

    await recordAuditLog({
      tenantId: tenant.id,
      actorId: currentSession!.userId,
      actorEmail: currentSession!.email,
      actorType: 'PLATFORM_USER',
      action: 'IMPERSONATION_STARTED',
      resource: 'tenant',
      resourceId: tenant.id,
      changes: { targetTenantName: tenant.name },
    });

    const token = signSessionToken(impersonatedSession);
    const res = NextResponse.json({
      success: true,
      data: { redirectUrl: '/app' },
    });
    res.headers.set('Set-Cookie', createSessionCookieHeader(token));
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
