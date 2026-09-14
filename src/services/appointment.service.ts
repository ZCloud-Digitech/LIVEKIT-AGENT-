import { db } from '@/lib/db';

export async function listAppointments(tenantId: string, status?: string) {
  const where: any = { tenantId };
  if (status) where.status = status;

  return db.appointment.findMany({
    where,
    include: {
      customer: true,
      agent: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
}

export async function createAppointment(tenantId: string, data: {
  customerId?: string;
  agentId?: string;
  title: string;
  serviceName: string;
  date: string;
  time: string;
  durationMinutes?: number;
  notes?: string;
}) {
  return db.appointment.create({
    data: {
      tenantId,
      customerId: data.customerId,
      agentId: data.agentId,
      title: data.title,
      serviceName: data.serviceName,
      date: data.date,
      time: data.time,
      durationMinutes: data.durationMinutes || 30,
      status: 'UPCOMING',
      notes: data.notes,
    },
    include: { customer: true },
  });
}

export async function updateAppointmentStatus(tenantId: string, appointmentId: string, status: string) {
  return db.appointment.updateMany({
    where: { id: appointmentId, tenantId },
    data: { status },
  });
}
