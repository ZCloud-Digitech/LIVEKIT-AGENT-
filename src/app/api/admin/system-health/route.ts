import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertPlatformAccess } from '@/lib/security';
import { getSystemHealth } from '@/services/system-health.service';

export async function GET() {
  try {
    const session = await getSession();
    assertPlatformAccess(session);

    const health = await getSystemHealth();
    return NextResponse.json({ success: true, data: health });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
