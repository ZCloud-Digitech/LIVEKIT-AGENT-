import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertPlatformAccess } from '@/lib/security';
import { listAuditLogs } from '@/services/audit.service';

export async function GET() {
  try {
    const session = await getSession();
    assertPlatformAccess(session);

    const logs = await listAuditLogs(undefined, 100);
    return NextResponse.json({ success: true, data: { logs } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
