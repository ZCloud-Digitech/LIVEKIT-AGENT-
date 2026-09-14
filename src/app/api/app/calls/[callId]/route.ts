import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { getCallDetails } from '@/services/call.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const { callId } = await params;
    const call = await getCallDetails(session.tenantId, callId);

    if (!call) {
      return NextResponse.json({ success: false, error: { message: 'Call not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { call } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
