import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { createLiveKitSessionToken } from '@/services/livekit.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const { agentId } = await params;
    const body = await req.json().catch(() => ({}));

    // Verify agent belongs to tenant
    const agent = await db.agent.findFirst({
      where: { id: agentId, tenantId: session.tenantId },
    });

    if (!agent) {
      return NextResponse.json({ success: false, error: { message: 'Agent not found in your organization.' } }, { status: 404 });
    }

    const tokenResponse = await createLiveKitSessionToken({
      tenantId: session.tenantId,
      agentId,
      agentVersionId: agent.currentVersionId || undefined,
      environment: (body.environment as any) || 'development',
      participantName: session.name || 'Test User',
      isTestSession: body.isTestSession ?? true,
    });

    return NextResponse.json({
      success: true,
      data: tokenResponse,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
