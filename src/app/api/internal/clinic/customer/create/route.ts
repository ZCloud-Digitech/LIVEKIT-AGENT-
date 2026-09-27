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

    const { tenantId, name, phone, email, notes } = body || {};

    if (!tenantId || !tenantId.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'tenantId is required.' } },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'name is required.' } },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim() || phone.replace(/[^\d]/g, '').length < 7) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Valid phone number with at least 7 digits is required.' } },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(phone.trim());
    const cleanName = name.trim();
    const cleanEmail = email?.trim()?.toLowerCase() || null;

    // Check for existing customer in this tenant to prevent duplicate creation
    const existing = await db.customer.findUnique({
      where: {
        tenantId_phone: {
          tenantId: tenantId.trim(),
          phone: cleanPhone,
        },
      },
    });

    if (existing) {
      const updated = await db.customer.update({
        where: { id: existing.id },
        data: {
          name: cleanName,
          email: cleanEmail || existing.email,
          notes: notes ? (existing.notes ? `${existing.notes} | ${notes}` : notes) : existing.notes,
          lastContactedAt: new Date(),
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
          customer: updated,
          isExisting: true,
        },
      });
    }

    const customer = await db.customer.create({
      data: {
        tenantId: tenantId.trim(),
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        notes: notes?.trim() || null,
        totalCalls: 1,
        lastContactedAt: new Date(),
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
        customer,
        isExisting: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'Error creating customer.' } },
      { status: 500 }
    );
  }
}
