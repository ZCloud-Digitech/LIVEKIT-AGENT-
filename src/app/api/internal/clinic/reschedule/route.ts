import { NextRequest, NextResponse } from 'next/server';
import { localDbCalendar } from '@/services/calendar.service';

/**
 * Backend-controlled Clinic Appointment Rescheduling API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Atomically shifts the slotKey to the new time slot after verifying availability.
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

    const { tenantId, appointmentId, newDate, newTime } = body;
    if (!tenantId || !appointmentId || !newDate || !newTime) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId, appointmentId, newDate, and newTime are required.',
          },
        },
        { status: 400 }
      );
    }

    const result = await localDbCalendar.rescheduleAppointment({
      tenantId,
      appointmentId,
      newDate,
      newTime,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = err.code === 'SLOT_UNAVAILABLE' ? 409 : 500;
    return NextResponse.json(
      {
        success: false,
        error: {
          code: err.code || 'INTERNAL_ERROR',
          message: err.message || 'Error rescheduling appointment.',
        },
      },
      { status }
    );
  }
}
