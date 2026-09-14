import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { listAppointments, createAppointment, updateAppointmentStatus } from '@/services/appointment.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const appointments = await listAppointments(session.tenantId, status);

    return NextResponse.json({ success: true, data: { appointments } });
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
    assertTenantAccess(session, session.tenantId);

    const body = await req.json();

    if (body.action === 'UPDATE_STATUS') {
      await updateAppointmentStatus(session.tenantId, body.appointmentId, body.status);
      return NextResponse.json({ success: true });
    }

    const appointment = await createAppointment(session.tenantId, body);
    return NextResponse.json({ success: true, data: { appointment } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
