import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { getAgentById, saveAgentConfigurationDraft, setAgentStatus } from '@/services/agent.service';

export async function GET(
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
    const agent = await getAgentById(session.tenantId, agentId);

    if (!agent) {
      return NextResponse.json({ success: false, error: { message: 'Agent not found' } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { agent } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN', 'MANAGER']);

    const { agentId } = await params;
    const body = await req.json();

    if (body.status) {
      await setAgentStatus(session.tenantId, agentId, body.status, {
        id: session.userId,
        email: session.email,
      });
    }

    if (body.config) {
      await saveAgentConfigurationDraft(session.tenantId, agentId, body.config, {
        id: session.userId,
        email: session.email,
      });
    }

    const updated = await getAgentById(session.tenantId, agentId);
    return NextResponse.json({ success: true, data: { agent: updated } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
