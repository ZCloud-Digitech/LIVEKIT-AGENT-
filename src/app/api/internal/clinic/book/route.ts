import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function safeJsonParse(val: string | null | undefined, fallback: any = {}) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Backend-controlled Appointment Booking API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Enforces tenant isolation, input validation, double-booking prevention,
 * idempotency, and atomic customer/appointment persistence.
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

    // 2. Parse and validate body
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
    } = body;

    // Validate mandatory fields
    if (!tenantId || !patientName || !phone || !date || !time) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId, patientName, phone, date, and time are required fields.',
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
            code: 'INVALID_INPUT',
            message: 'Patient name must be at least 2 characters long.',
          },
        },
        { status: 400 }
      );
    }

    // Validate phone number (must contain at least 7 digits)
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PHONE',
            message: 'A valid telephone number with at least 7 digits is required.',
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

    // 5. Double Booking Check & Idempotency
    const existingBooking = await db.appointment.findFirst({
      where: {
        tenantId,
        date,
        time: trimmedTime,
        status: { in: ['UPCOMING', 'CONFIRMED'] },
      },
      include: { customer: true },
    });

    if (existingBooking) {
      // Idempotency: If this exact appointment was already booked for this customer/phone, return success
      const samePhone = existingBooking.customer?.phone === trimmedPhone;
      const sameName = existingBooking.customer?.name.toLowerCase() === trimmedName.toLowerCase();

      if (samePhone || sameName) {
        return NextResponse.json({
          success: true,
          data: {
            appointmentId: existingBooking.id,
            status: existingBooking.status,
            date: existingBooking.date,
            time: existingBooking.time,
            serviceName: existingBooking.serviceName,
            patientName: trimmedName,
            phone: trimmedPhone,
            isExisting: true,
            message: 'Appointment is already confirmed for this time slot.',
          },
        });
      }

      // Conflict: Slot already taken by another patient
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

    // 6. Execute Transaction: Upsert Customer + Create Appointment
    const bookingResult = await db.$transaction(async (tx) => {
      // Find or create customer
      let customer = await tx.customer.findUnique({
        where: {
          tenantId_phone: {
            tenantId,
            phone: trimmedPhone,
          },
        },
      });

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: trimmedName,
            totalCalls: { increment: 1 },
            lastContactedAt: new Date(),
          },
        });
      } else {
        customer = await tx.customer.create({
          data: {
            tenantId,
            name: trimmedName,
            phone: trimmedPhone,
            totalCalls: 1,
            lastContactedAt: new Date(),
          },
        });
      }

      // Verify agentId if provided
      let effectiveAgentId: string | null = null;
      if (agentId) {
        const agent = await tx.agent.findFirst({
          where: { id: agentId, tenantId },
          select: { id: true },
        });
        if (agent) effectiveAgentId = agent.id;
      }

      // Verify callId if provided
      let effectiveCallId: string | null = null;
      if (callId) {
        const call = await tx.call.findFirst({
          where: { id: callId, tenantId },
          select: { id: true },
        });
        if (call) effectiveCallId = call.id;
      }

      // Create Appointment
      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          customerId: customer.id,
          agentId: effectiveAgentId,
          callId: effectiveCallId,
          title: `${trimmedService} - ${trimmedName}`,
          serviceName: trimmedService,
          date,
          time: trimmedTime,
          durationMinutes: 30,
          status: 'UPCOMING',
          notes: notes || 'Booked via Clinic AI Voice Assistant',
        },
      });

      return {
        appointmentId: appointment.id,
        status: appointment.status,
        date: appointment.date,
        time: appointment.time,
        serviceName: appointment.serviceName,
        patientName: trimmedName,
        phone: trimmedPhone,
        isExisting: false,
        message: 'Appointment successfully confirmed.',
      };
    });

    return NextResponse.json({
      success: true,
      data: bookingResult,
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
