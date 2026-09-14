import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { publishAgentVersion } from '@/services/agent.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN']);

    const { agentId } = await params;
    const { versionId } = await req.json();

    if (!versionId) {
      return NextResponse.json({ success: false, error: { message: 'versionId is required.' } }, { status: 400 });
    }

    const version = await publishAgentVersion(session.tenantId, agentId, versionId, {
      id: session.userId,
      email: session.email,
    });

    return NextResponse.json({ success: true, data: { version } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
