import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const phoneNumbers = await db.phoneNumber.findMany({
      where: { tenantId: session.tenantId },
    });

    return NextResponse.json({ success: true, data: { phoneNumbers } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN']);

    const body = await req.json();
    const cleanNum = body.number.replace(/[^0-9+]/g, '');

    const phone = await db.phoneNumber.create({
      data: {
        tenantId: session.tenantId,
        number: cleanNum,
        formatted: body.number,
        provider: body.provider || 'Twilio',
        assignedAgentId: body.assignedAgentId || null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ success: true, data: { phone } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
