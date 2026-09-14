import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertPlatformAccess } from '@/lib/security';
import { getTenantById, updateTenantStatus } from '@/services/tenant.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getSession();
    assertPlatformAccess(session);

    const { tenantId } = await params;
    const tenant = await getTenantById(tenantId);

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found.' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { tenant } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getSession();
    assertPlatformAccess(session, ['SUPER_ADMIN', 'ADMIN']);

    const { tenantId } = await params;
    const { status } = await req.json();

    const updated = await updateTenantStatus(tenantId, status, {
      id: session!.userId,
      email: session!.email,
    });

    return NextResponse.json({ success: true, data: { tenant: updated } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
