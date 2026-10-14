import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { getTenantUsageSummary, calculateSubscriptionBilling } from '@/services/entitlement.service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const [usage, billing] = await Promise.all([
      getTenantUsageSummary(session.tenantId),
      calculateSubscriptionBilling(session.tenantId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...usage,
        billing,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
