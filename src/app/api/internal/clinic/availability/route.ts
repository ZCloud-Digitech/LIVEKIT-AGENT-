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
 * Backend-controlled Appointment Availability API
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 * Tenant-scoped, validates dates, queries real database state, and respects clinic business hours.
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

    const { tenantId, date, serviceName } = body;

    if (!tenantId || !date) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId and date are required fields.',
          },
        },
        { status: 400 }
      );
    }

    // 3. Validate date format (YYYY-MM-DD)
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

    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DATE',
            message: 'Invalid calendar date provided.',
          },
        },
        { status: 400 }
      );
    }

    // 4. Verify tenant exists and is active
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

    // 5. Determine Day of Week and Business Hours
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = daysOfWeek[parsedDate.getUTCDay()];

    // Resolve hours from active agent version or default schedule
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
      return NextResponse.json({
        success: true,
        data: {
          tenantId,
          date,
          dayOfWeek: dayName,
          isOpen: false,
          reason: `Clinic is closed on ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}s.`,
          availableSlots: [],
          totalAvailable: 0,
        },
      });
    }

    // 6. Generate standard 30-minute appointment slots within operating hours
    const openParts = daySchedule.open.split(':').map(Number);
    const closeParts = daySchedule.close.split(':').map(Number);
    const openMinutes = openParts[0] * 60 + (openParts[1] || 0);
    const closeMinutes = closeParts[0] * 60 + (closeParts[1] || 0);

    const generatedSlots: string[] = [];
    for (let m = openMinutes; m + 30 <= closeMinutes; m += 30) {
      const hh = Math.floor(m / 60).toString().padStart(2, '0');
      const mm = (m % 60).toString().padStart(2, '0');
      generatedSlots.push(`${hh}:${mm}`);
    }

    // 7. Query authoritative database for booked appointments
    const bookedAppointments = await db.appointment.findMany({
      where: {
        tenantId,
        date,
        status: { in: ['UPCOMING', 'CONFIRMED', 'SCHEDULED', 'RESCHEDULED'] },
      },
      select: { time: true },
    });

    const bookedSet = new Set(bookedAppointments.map((a) => a.time));
    const availableSlots = generatedSlots.filter((slot) => !bookedSet.has(slot));

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        date,
        dayOfWeek: dayName,
        isOpen: true,
        openTime: daySchedule.open,
        closeTime: daySchedule.close,
        serviceName: serviceName || 'General Consultation',
        availableSlots,
        totalAvailable: availableSlots.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An error occurred while checking appointment availability.',
        },
      },
      { status: 500 }
    );
  }
}
