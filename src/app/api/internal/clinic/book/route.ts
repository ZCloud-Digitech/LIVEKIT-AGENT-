import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { localDbCalendar, googleCalendar } from '@/services/calendar.service';
import { googleSheetsService } from '@/services/google-sheets.service';
import { whatsappService } from '@/services/whatsapp.service';

function safeJsonParse(val: string | null | undefined, fallback: any = {}) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Backend-controlled Clinic Appointment Booking API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Guaranteed Race-Condition Protected via DB slotKey unique lock.
 * Dispatches to Google Calendar, Google Sheets, and WhatsApp safely without failing database booking.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via WORKER_API_SECRET
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

    // 2. Parse payload
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

    const {
      tenantId,
      agentId,
      callId,
      patientName,
      phone,
      date,
      time,
      serviceName,
      notes,
      idempotencyKey,
    } = body;

    // Validate required fields
    if (!tenantId || !patientName || !phone || !date || !time) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId, patientName, phone, date, and time are required.',
          },
        },
        { status: 400 }
      );
    }

    const trimmedName = String(patientName).trim();
    const trimmedPhone = String(phone).trim();
    const trimmedTime = String(time).trim();
    const trimmedService = String(serviceName || 'General Consultation').trim();

    if (trimmedName.length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_NAME',
            message: 'Patient name must be at least 2 characters long.',
          },
        },
        { status: 400 }
      );
    }

    // Validate phone number
    const cleanDigits = trimmedPhone.replace(/\D/g, '');
    if (cleanDigits.length < 7) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHONE',
            message: 'Phone number must contain at least 7 valid digits.',
          },
        },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Date must be formatted as YYYY-MM-DD.',
          },
        },
        { status: 400 }
      );
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(trimmedTime)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TIME',
            message: 'Time must be in 24-hour format HH:mm (e.g., 10:30 or 14:00).',
          },
        },
        { status: 400 }
      );
    }

    // 3. Verify tenant exists and is active
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        status: true,
        timezone: true,
        agents: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            versions: {
              where: { isPublished: true },
              orderBy: { versionNumber: 'desc' },
              take: 1,
              select: { businessHoursJson: true },
            },
          },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_NOT_FOUND',
            message: `Tenant ${tenantId} not found.`,
          },
        },
        { status: 404 }
      );
    }

    if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TENANT_INACTIVE',
            message: `Tenant ${tenantId} is ${tenant.status}.`,
          },
        },
        { status: 403 }
      );
    }

    // 4. Verify operating hours for requested date and time
    const parsedDate = new Date(`${date}T12:00:00Z`);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = daysOfWeek[parsedDate.getUTCDay()];

    let businessHours: any = null;
    if (tenant.agents?.[0]?.versions?.[0]?.businessHoursJson) {
      businessHours = safeJsonParse(tenant.agents[0].versions[0].businessHoursJson, null);
    }

    const defaultSchedule: Record<string, { open: string; close: string; closed: boolean }> = {
      monday: { open: '08:00', close: '18:00', closed: false },
      tuesday: { open: '08:00', close: '18:00', closed: false },
      wednesday: { open: '08:00', close: '18:00', closed: false },
      thursday: { open: '08:00', close: '18:00', closed: false },
      friday: { open: '08:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '13:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    };

    const daySchedule = businessHours?.schedule?.[dayName] || defaultSchedule[dayName];
    if (!daySchedule || daySchedule.closed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CLINIC_CLOSED',
            message: `Clinic is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s. Appointments cannot be booked on closed days.`,
          },
        },
        { status: 400 }
      );
    }

    // Verify time is within open/close range
    if (trimmedTime < daySchedule.open || trimmedTime >= daySchedule.close) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'OUTSIDE_BUSINESS_HOURS',
            message: `Requested time ${trimmedTime} is outside operating hours (${daySchedule.open} - ${daySchedule.close}).`,
          },
        },
        { status: 400 }
      );
    }

    // 5. Execute transactional booking via Calendar Provider (Atomic slotKey check & lock)
    let bookingResult;
    try {
      bookingResult = await localDbCalendar.createAppointment({
        tenantId,
        agentId,
        callId,
        patientName: trimmedName,
        phone: trimmedPhone,
        date,
        time: trimmedTime,
        serviceName: trimmedService,
        notes,
        idempotencyKey,
      });
    } catch (createErr: any) {
      if (createErr.code === 'SLOT_UNAVAILABLE' || createErr.message?.includes('already booked') || createErr.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SLOT_UNAVAILABLE',
              message: `The ${trimmedTime} time slot on ${date} is already booked. Please select another open time slot.`,
            },
          },
          { status: 409 }
        );
      }
      throw createErr;
    }

    // 6. Post-booking Integrations: Google Calendar, Google Sheets, WhatsApp
    // Handled asynchronously with graceful failure isolation (database appointment remains 100% confirmed)
    let googleEventId = bookingResult.googleEventId || null;
    let sheetSyncStatus = 'PENDING';
    let sheetRowId: string | null = null;
    let whatsappStatus = 'PENDING';
    let whatsappMessageId: string | null = null;

    try {
      // Sync Google Calendar
      const gcalRes = await googleCalendar.syncEvent({
        id: bookingResult.appointmentId,
        tenantId,
        title: `${trimmedService} - ${trimmedName}`,
        serviceName: trimmedService,
        date,
        time: trimmedTime,
        durationMinutes: 30,
        patientName: trimmedName,
        phone: trimmedPhone,
      });
      if (gcalRes.success && gcalRes.googleEventId) {
        googleEventId = gcalRes.googleEventId;
      }
    } catch (gcalErr) {
      console.warn('Non-blocking Google Calendar sync error:', gcalErr);
    }

    try {
      // Sync Google Sheets
      const sheetRes = await googleSheetsService.syncAppointment({
        bookingId: bookingResult.appointmentId,
        customerName: trimmedName,
        phone: trimmedPhone,
        serviceName: trimmedService,
        date,
        time: trimmedTime,
        timezone: tenant.timezone,
        tenantId,
        agentId,
        status: bookingResult.status,
        createdAt: new Date().toISOString(),
      });
      sheetSyncStatus = sheetRes.sheetSyncStatus;
      sheetRowId = sheetRes.sheetRowId || null;
    } catch (sheetErr) {
      console.warn('Non-blocking Google Sheets sync error:', sheetErr);
      sheetSyncStatus = 'FAILED';
    }

    try {
      // Send WhatsApp Confirmation
      const waRes = await whatsappService.sendAppointmentConfirmation({
        bookingId: bookingResult.appointmentId,
        customerName: trimmedName,
        phone: trimmedPhone,
        serviceName: trimmedService,
        date,
        time: trimmedTime,
        clinicName: tenant.name,
        tenantId,
      });
      whatsappStatus = waRes.whatsappStatus;
      whatsappMessageId = waRes.whatsappMessageId || null;
    } catch (waErr) {
      console.warn('Non-blocking WhatsApp confirmation error:', waErr);
      whatsappStatus = 'FAILED';
    }

    // 7. Persist integration status updates
    await db.appointment.update({
      where: { id: bookingResult.appointmentId },
      data: {
        googleEventId,
        sheetSyncStatus,
        sheetRowId,
        whatsappStatus,
        whatsappMessageId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...bookingResult,
        googleEventId,
        sheetSyncStatus,
        sheetRowId,
        whatsappStatus,
        whatsappMessageId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred while booking the appointment.',
        },
      },
      { status: 500 }
    );
  }
}
