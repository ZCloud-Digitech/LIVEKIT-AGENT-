import { NextRequest, NextResponse } from 'next/server';
import { clinicService } from '@/services/clinic.service';
import { db } from '@/lib/db';

function verifyWorkerAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedSecret = process.env.WORKER_API_SECRET;
  return Boolean(expectedSecret && token && token === expectedSecret);
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWorkerAuth(req)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing worker API secret.' } },
        { status: 401 }
      );
    }

    let tenantId = req.nextUrl.searchParams.get('tenantId');
    try {
      const body = await req.json();
      if (body?.tenantId) tenantId = body.tenantId;
    } catch {
      // Query param fallback
    }

    if (!tenantId || !tenantId.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'tenantId is required.' } },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId.trim() },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'TENANT_NOT_FOUND', message: `Tenant ${tenantId} not found.` } },
        { status: 404 }
      );
    }

    const services = await clinicService.listServices(tenantId.trim(), true);

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenantId.trim(),
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          durationMinutes: s.durationMinutes,
          price: s.price,
        })),
        totalServices: services.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Error fetching services.' } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
