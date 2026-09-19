import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { listCalls } from '@/services/call.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agentId') || undefined;
    const status = searchParams.get('status') || undefined;
    const outcome = searchParams.get('outcome') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

    const result = await listCalls(session.tenantId, {
      agentId,
      status,
      outcome,
      search,
      limit,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Authoritative call creation and usage recording must be performed by the worker via /api/internal/call-session.',
      },
    },
    { status: 403 }
  );
}
