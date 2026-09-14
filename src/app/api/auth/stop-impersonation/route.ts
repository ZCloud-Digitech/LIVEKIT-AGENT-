import { NextResponse } from 'next/server';
import { getSession, signSessionToken, createSessionCookieHeader } from '@/lib/auth';
import { recordAuditLog } from '@/services/audit.service';
import { AuthSession } from '@/types';

export async function POST() {
  try {
    const currentSession = await getSession();
    if (!currentSession || !currentSession.isImpersonating) {
      return NextResponse.json({ success: true, data: { redirectUrl: '/admin' } });
    }

    // Revert back to pure platform admin session
    const revertedSession: AuthSession = {
      userId: currentSession.userId,
      email: currentSession.impersonatedBy || currentSession.email,
      name: currentSession.name.replace(' (Support Mode)', ''),
      isPlatformUser: true,
      platformRole: currentSession.platformRole || 'ADMIN',
    };

    await recordAuditLog({
      tenantId: currentSession.tenantId,
      actorId: currentSession.userId,
      actorEmail: currentSession.email,
      actorType: 'PLATFORM_USER',
      action: 'IMPERSONATION_ENDED',
      resource: 'tenant',
      resourceId: currentSession.tenantId,
    });

    const token = signSessionToken(revertedSession);
    const res = NextResponse.json({
      success: true,
      data: { redirectUrl: '/admin' },
    });
    res.headers.set('Set-Cookie', createSessionCookieHeader(token));
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { message: err.message } },
      { status: 500 }
    );
  }
}
