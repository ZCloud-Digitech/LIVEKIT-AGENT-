import { NextRequest, NextResponse } from 'next/server';
import { resolveInboundSipRoute } from '@/services/sip.service';

function verifyWorkerAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedSecret = process.env.WORKER_API_SECRET;
  return Boolean(expectedSecret && token && token === expectedSecret);
}

/**
 * M2M Internal Endpoint: Authoritative Inbound SIP Resolution & Call Initialization
 *
 * Security:
 * - Requires Authorization: Bearer <WORKER_API_SECRET>
 * - Never trusts client-side tenantId or agentId
 * - Resolves tenant and agent strictly from called phone number (DNIS)
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifyWorkerAuth(req)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or missing worker API secret.',
          },
        },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON payload.',
          },
        },
        { status: 400 }
      );
    }

    const { calledNumber, callerNumber, callId, sipTrunkId, roomName } = body || {};

    if (!calledNumber || typeof calledNumber !== 'string' || !calledNumber.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'calledNumber is required for inbound SIP routing.',
          },
        },
        { status: 400 }
      );
    }

    const routingResult = await resolveInboundSipRoute({
      calledNumber,
      callerNumber,
      callId,
      sipTrunkId,
      roomName,
    });

    return NextResponse.json({
      success: true,
      data: routingResult,
    });
  } catch (err: any) {
    const msg = err.message || 'An error occurred during inbound SIP routing.';
    let status = 500;
    let code = 'INTERNAL_ERROR';

    if (msg.includes('INVALID_PHONE_NUMBER')) {
      status = 400;
      code = 'INVALID_PHONE_NUMBER';
    } else if (msg.includes('PHONE_NUMBER_NOT_FOUND')) {
      status = 404;
      code = 'PHONE_NUMBER_NOT_FOUND';
    } else if (msg.includes('PHONE_NUMBER_INACTIVE')) {
      status = 403;
      code = 'PHONE_NUMBER_INACTIVE';
    } else if (msg.includes('TENANT_NOT_FOUND')) {
      status = 404;
      code = 'TENANT_NOT_FOUND';
    } else if (msg.includes('TENANT_INACTIVE')) {
      status = 403;
      code = 'TENANT_INACTIVE';
    } else if (msg.includes('QUOTA_EXCEEDED')) {
      status = 402;
      code = 'QUOTA_EXCEEDED';
    } else if (msg.includes('AGENT_NOT_FOUND')) {
      status = 404;
      code = 'AGENT_NOT_FOUND';
    } else if (msg.includes('VERSION_UNPUBLISHED')) {
      status = 400;
      code = 'VERSION_UNPUBLISHED';
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message: msg,
        },
      },
      { status }
    );
  }
}
