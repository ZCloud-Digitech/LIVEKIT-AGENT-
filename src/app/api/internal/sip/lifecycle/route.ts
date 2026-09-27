import { NextRequest, NextResponse } from 'next/server';
import { updateCallLifecycle, CallLifecycleStatus } from '@/services/sip.service';

function verifyWorkerAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const expectedSecret = process.env.WORKER_API_SECRET;
  return Boolean(expectedSecret && token && token === expectedSecret);
}

const ALLOWED_STATUSES: Set<string> = new Set([
  'INCOMING',
  'CONNECTING',
  'ANSWERED',
  'ACTIVE',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
  'TRANSFERRED',
]);

/**
 * M2M Internal Endpoint: Updates Call Lifecycle State with Server-Side Validation
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

    const { callId, status, endReason, durationSeconds, failureReason, outcome, summary } = body || {};

    if (!callId || typeof callId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'callId is required.',
          },
        },
        { status: 400 }
      );
    }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Invalid status: ${status}. Allowed: ${Array.from(ALLOWED_STATUSES).join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const updated = await updateCallLifecycle(callId, status as CallLifecycleStatus, {
      endReason,
      durationSeconds,
      failureReason,
      outcome,
      summary,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    const msg = err.message || 'Error updating call lifecycle.';
    const isNotFound = msg.includes('CALL_NOT_FOUND');
    const isInvalidTransition = msg.includes('INVALID_LIFECYCLE_TRANSITION');
    const statusCode = isNotFound ? 404 : isInvalidTransition ? 400 : 500;
    const errorCode = isNotFound
      ? 'CALL_NOT_FOUND'
      : isInvalidTransition
      ? 'INVALID_LIFECYCLE_TRANSITION'
      : 'INTERNAL_ERROR';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message: msg,
        },
      },
      { status: statusCode }
    );
  }
}
