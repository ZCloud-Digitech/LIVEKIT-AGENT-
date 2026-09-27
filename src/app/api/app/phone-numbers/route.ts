import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { normalizePhoneNumber, validateSipIdentity } from '@/services/sip.service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const phoneNumbers = await db.phoneNumber.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch active agents to facilitate assignment in the UI
    const agents = await db.agent.findMany({
      where: { tenantId: session.tenantId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, data: { phoneNumbers, agents } });
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
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN']);

    const body = await req.json();
    const rawNumber = body.number || '';

    const validation = validateSipIdentity(rawNumber);
    if (!validation.isValid || !validation.normalized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHONE_NUMBER',
            message: validation.error || 'Invalid phone number format.',
          },
        },
        { status: 400 }
      );
    }

    const cleanNum = validation.normalized;

    // Check if number already registered
    const existing = await db.phoneNumber.findFirst({
      where: { number: cleanNum },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PHONE_NUMBER_EXISTS',
            message: `Phone number ${cleanNum} is already registered.`,
          },
        },
        { status: 409 }
      );
    }

    const phone = await db.phoneNumber.create({
      data: {
        tenantId: session.tenantId,
        number: cleanNum,
        formatted: body.formatted || cleanNum,
        provider: body.provider || 'Plivo',
        assignedAgentId: body.assignedAgentId || null,
        providerNumberId: body.providerNumberId || null,
        sipTrunkId: body.sipTrunkId || null,
        direction: body.direction || 'INBOUND',
        status: body.status || 'ACTIVE',
      },
    });

    return NextResponse.json({ success: true, data: { phone } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN']);

    const body = await req.json();
    const { id, assignedAgentId, status } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Phone number id is required.' } },
        { status: 400 }
      );
    }

    const existing = await db.phoneNumber.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Phone number not found.' } },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (assignedAgentId !== undefined) {
      updateData.assignedAgentId = assignedAgentId || null;
    }
    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'].includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid status value.' } },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    const updated = await db.phoneNumber.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: { phone: updated } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
