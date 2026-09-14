import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { listCalls, createCallRecord } from '@/services/call.service';

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
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const body = await req.json();
    const call = await createCallRecord({
      tenantId: session.tenantId,
      agentId: body.agentId,
      agentVersionId: body.agentVersionId,
      callerNumber: body.callerNumber || '+1 (555) 000-TEST',
      callerName: body.callerName || session.name,
      direction: body.direction || 'INBOUND',
      durationSeconds: body.durationSeconds || 45,
      intent: body.intent || 'Test Inquiry',
      outcome: body.outcome || 'RESOLVED',
      summary: body.summary,
      sentiment: body.sentiment,
      transcripts: body.transcripts || [],
    });

    return NextResponse.json({ success: true, data: { call } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
