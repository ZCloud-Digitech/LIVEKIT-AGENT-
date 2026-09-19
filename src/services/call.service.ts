import { db } from '@/lib/db';

export async function listCalls(
  tenantId: string,
  params?: {
    agentId?: string;
    status?: string;
    outcome?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: any = { tenantId };

  if (params?.agentId) where.agentId = params.agentId;
  if (params?.status) where.status = params.status;
  if (params?.outcome) where.outcome = params.outcome;
  if (params?.search) {
    where.OR = [
      { callerNumber: { contains: params.search } },
      { callerName: { contains: params.search } },
      { intent: { contains: params.search } },
    ];
  }

  const [calls, total] = await Promise.all([
    db.call.findMany({
      where,
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 20,
      skip: params?.offset || 0,
    }),
    db.call.count({ where }),
  ]);

  return { calls, total };
}

export async function getCallDetails(tenantId: string, callId: string) {
  return db.call.findFirst({
    where: { id: callId, tenantId },
    include: {
      agent: true,
      transcripts: {
        orderBy: { timestampOffsetMs: 'asc' },
      },
      events: {
        orderBy: { createdAt: 'asc' },
      },
      appointments: true,
    },
  });
}
