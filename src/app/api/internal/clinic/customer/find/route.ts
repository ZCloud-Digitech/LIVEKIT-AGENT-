import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function verifyWorkerAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedSecret = process.env.WORKER_API_SECRET;
  return Boolean(expectedSecret && token && token === expectedSecret);
}

function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, '').trim();
  if (digits.length === 10 && !digits.startsWith('+')) {
    return `+1${digits}`;
  }
  return digits;
}

export async function POST(req: NextRequest) {
  try {
    if (!verifyWorkerAuth(req)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing worker API secret.' } },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload.' } },
        { status: 400 }
      );
    }

    const { tenantId, phone, email } = body || {};

    if (!tenantId || !tenantId.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'tenantId is required.' } },
        { status: 400 }
      );
    }

    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'phone or email must be provided to find customer.' } },
        { status: 400 }
      );
    }

    const whereOr: any[] = [];
    if (phone && phone.trim()) {
      const cleanPhone = normalizePhone(phone.trim());
      whereOr.push({ phone: cleanPhone });
      whereOr.push({ phone: phone.trim() });
    }
    if (email && email.trim()) {
      whereOr.push({ email: email.trim().toLowerCase() });
    }

    const customer = await db.customer.findFirst({
      where: {
        tenantId: tenantId.trim(),
        OR: whereOr,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        totalCalls: true,
        lastContactedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenantId.trim(),
        customer: customer || null,
        found: customer !== null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Error finding customer.' } },
      { status: 500 }
    );
  }
}
