import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { listCustomers, getCustomerById, createOrUpdateCustomer } from '@/services/customer.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const customerId = searchParams.get('id') || undefined;

    if (customerId) {
      const customer = await getCustomerById(session.tenantId, customerId);
      return NextResponse.json({ success: true, data: { customer } });
    }

    const customers = await listCustomers(session.tenantId, search);
    return NextResponse.json({ success: true, data: { customers } });
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
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN', 'MANAGER', 'STAFF']);

    const body = await req.json();
    const customer = await createOrUpdateCustomer(session.tenantId, body);
    return NextResponse.json({ success: true, data: { customer } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
