import { NextRequest, NextResponse } from 'next/server';
import { localDbCalendar } from '@/services/calendar.service';

/**
 * Backend-controlled Clinic Appointment Cancellation API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Frees the slotKey so the time slot becomes open for other callers.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const expectedSecret = process.env.WORKER_API_SECRET;
    if (!expectedSecret || !token || token !== expectedSecret) {
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

    const { tenantId, appointmentId, reason } = body;
    if (!tenantId || !appointmentId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId and appointmentId are required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await localDbCalendar.cancelAppointment({
      tenantId,
      appointmentId,
      reason,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'Error cancelling appointment.',
        },
      },
      { status: 500 }
    );
  }
}
