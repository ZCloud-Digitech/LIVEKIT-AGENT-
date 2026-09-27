import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { clinicService } from '@/services/clinic.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const hours = await clinicService.getBusinessHours(session.tenantId);
    return NextResponse.json({ success: true, data: { hours } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'ERROR', message: err.message } },
      { status: err.statusCode || 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN', 'MANAGER']);

    const body = await req.json();
    const hours = await clinicService.upsertBusinessHours(session.tenantId, body.hours || body);
    return NextResponse.json({ success: true, data: { hours } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
