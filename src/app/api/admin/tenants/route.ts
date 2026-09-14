import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertPlatformAccess } from '@/lib/security';
import { listTenants, createTenantWithWizard } from '@/services/tenant.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    assertPlatformAccess(session);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const planId = searchParams.get('planId') || undefined;
    const industry = searchParams.get('industry') || undefined;

    const tenants = await listTenants({ search, status, planId, industry });
    return NextResponse.json({ success: true, data: { tenants } });
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
    assertPlatformAccess(session, ['SUPER_ADMIN', 'ADMIN']);

    const wizardInput = await req.json();
    const tenant = await createTenantWithWizard(wizardInput, {
      id: session!.userId,
      email: session!.email,
    });

    return NextResponse.json({ success: true, data: { tenant } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
