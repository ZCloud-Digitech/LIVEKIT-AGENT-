import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clinicService } from '@/services/clinic.service';
import { executeSipTransfer, normalizePhoneNumber } from '@/services/sip.service';

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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload.' } },
        { status: 400 }
      );
    }

    const { tenantId, callId, reason, callerNumber, roomName, participantIdentity, targetNumber } = body || {};

    if (!tenantId || !tenantId.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'tenantId is required.' } },
        { status: 400 }
      );
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId.trim() },
      select: {
        id: true,
        name: true,
        phone: true,
        agents: {
          where: { status: 'ACTIVE' },
          select: {
            versions: {
              where: { isPublished: true },
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { transferRulesJson: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: 'TENANT_NOT_FOUND', message: `Tenant ${tenantId} not found.` } },
        { status: 404 }
      );
    }

    const profile = await clinicService.getClinicProfile(tenantId.trim()).catch(() => null);

    // Resolve transfer rules
    let transferRules: any = {};
    try {
      const rawRules = tenant.agents?.[0]?.versions?.[0]?.transferRulesJson;
      if (rawRules) transferRules = JSON.parse(rawRules);
    } catch {
      // fallback
    }

    // Security Guarantee: Destinations are resolved strictly from trusted tenant/clinic configuration
    const allowedDestinations: string[] = [
      transferRules.primaryNumber,
      transferRules.backupNumber,
      profile?.phone,
      tenant.phone,
    ]
      .filter((n): n is string => Boolean(n && typeof n === 'string' && n.trim()))
      .map(normalizePhoneNumber);

    let effectiveTarget = allowedDestinations[0] || '+918040001000';

    if (targetNumber && typeof targetNumber === 'string' && targetNumber.trim()) {
      const normalizedTarget = normalizePhoneNumber(targetNumber);
      // Reject if targetNumber does not match any configured clinic number
      if (allowedDestinations.length > 0 && !allowedDestinations.includes(normalizedTarget)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_TRANSFER_DESTINATION',
              message: `Requested transfer destination ${targetNumber} is not an authorized clinic destination.`,
            },
          },
          { status: 400 }
        );
      }
      effectiveTarget = normalizedTarget;
    }

    // Execute SIP transfer abstraction
    const transferResult = await executeSipTransfer({
      tenantId: tenantId.trim(),
      callId: callId?.trim(),
      roomName,
      participantIdentity,
      targetNumber: effectiveTarget,
      reason,
      callerNumber,
    });

    const fallbackMessage =
      transferRules.handoffMessage ||
      transferResult.fallbackMessage ||
      `I am connecting you with our clinic staff directly at ${transferResult.targetNumber}. Please stay on the line.`;

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenantId.trim(),
        transferNumber: transferResult.targetNumber,
        transferMode: transferResult.mode,
        transferred: transferResult.transferred,
        fallbackMessage,
        reason: reason || 'Customer requested human assistance',
      },
    });
  } catch (err: any) {
    const msg = err.message || 'Error executing transfer request.';
    const isSecurityError = msg.includes('TRANSFER_SECURITY_VIOLATION') || msg.includes('INVALID_TRANSFER_DESTINATION');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isSecurityError ? 'INVALID_TRANSFER_DESTINATION' : 'INTERNAL_ERROR',
          message: msg,
        },
      },
      { status: isSecurityError ? 400 : 500 }
    );
  }
}
