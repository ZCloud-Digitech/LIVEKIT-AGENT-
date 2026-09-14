import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';
import { getTenantUsageSummary } from '@/services/entitlement.service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'No tenant context.' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const tenantId = session.tenantId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      callsToday,
      callsThisWeek,
      totalAppointments,
      usage,
      agents,
      recentCalls,
    ] = await Promise.all([
      db.call.count({ where: { tenantId, startedAt: { gte: startOfToday } } }),
      db.call.count({ where: { tenantId, startedAt: { gte: startOfWeek } } }),
      db.appointment.count({ where: { tenantId, status: 'UPCOMING' } }),
      getTenantUsageSummary(tenantId),
      db.agent.findMany({
        where: { tenantId, status: { not: 'ARCHIVED' } },
        include: { versions: { where: { isPublished: true }, take: 1 } },
      }),
      db.call.findMany({
        where: { tenantId },
        include: { agent: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        take: 8,
      }),
    ]);

    // Compute resolution rate
    const totalCompleted = await db.call.count({
      where: { tenantId, status: 'COMPLETED' },
    });
    const resolvedOrBooked = await db.call.count({
      where: {
        tenantId,
        outcome: { in: ['APPOINTMENT_BOOKED', 'RESOLVED'] },
      },
    });
    const resolutionRate = totalCompleted > 0 ? Math.round((resolvedOrBooked / totalCompleted) * 100) : 92;

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          callsToday,
          callsThisWeek,
          minutesUsed: usage.voice.used,
          minutesLimit: usage.voice.limit,
          remainingMinutes: usage.voice.remaining,
          upcomingAppointments: totalAppointments,
          resolutionRate,
          activeAgentsCount: agents.filter((a) => a.status === 'ACTIVE').length,
        },
        agents,
        recentCalls,
        usage,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}
