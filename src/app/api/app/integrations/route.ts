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

    const integrations = await db.integration.findMany({
      where: { tenantId: session.tenantId },
    });

    return NextResponse.json({ success: true, data: { integrations } });
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

    const { provider, name, action } = await req.json();

    if (action === 'DISCONNECT') {
      await db.integration.deleteMany({
        where: { tenantId: session.tenantId, provider },
      });
      return NextResponse.json({ success: true });
    }

    const integration = await db.integration.upsert({
      where: { tenantId_provider: { tenantId: session.tenantId, provider } },
      update: { status: 'CONNECTED', lastSyncAt: new Date() },
      create: {
        tenantId: session.tenantId,
        provider,
        name: name || provider,
        status: 'CONNECTED',
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { integration } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
