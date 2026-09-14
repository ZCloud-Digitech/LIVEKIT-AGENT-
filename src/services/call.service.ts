import { db } from '@/lib/db';
import { recordUsage } from './entitlement.service';

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

/**
 * Creates a completed simulated or real call record with automatic usage billing calculation.
 */
export async function createCallRecord(params: {
  tenantId: string;
  agentId: string;
  agentVersionId?: string;
  callerNumber: string;
  callerName?: string;
  direction?: string;
  durationSeconds: number;
  intent?: string;
  outcome?: string;
  summary?: string;
  sentiment?: string;
  transcripts?: Array<{
    speaker: 'AGENT' | 'CUSTOMER' | 'SYSTEM';
    message: string;
    toolInvocation?: string;
    toolResult?: string;
    latencyMs?: number;
    timestampOffsetMs: number;
  }>;
}) {
  const call = await db.call.create({
    data: {
      tenantId: params.tenantId,
      agentId: params.agentId,
      agentVersionId: params.agentVersionId,
      callerNumber: params.callerNumber,
      callerName: params.callerName,
      direction: params.direction || 'INBOUND',
      status: 'COMPLETED',
      durationSeconds: params.durationSeconds,
      intent: params.intent || 'Inquiry',
      outcome: params.outcome || 'RESOLVED',
      summary: params.summary || 'Simulated test call successfully completed.',
      sentiment: params.sentiment || 'POSITIVE',
      startedAt: new Date(Date.now() - params.durationSeconds * 1000),
      endedAt: new Date(),
    },
  });

  if (params.transcripts && params.transcripts.length > 0) {
    await db.callTranscript.createMany({
      data: params.transcripts.map((t) => ({
        callId: call.id,
        speaker: t.speaker,
        message: t.message,
        toolInvocation: t.toolInvocation,
        toolResult: t.toolResult,
        latencyMs: t.latencyMs,
        timestampOffsetMs: t.timestampOffsetMs,
      })),
    });
  }

  // Calculate billable minutes and record usage
  const minutes = Math.ceil(params.durationSeconds / 60);
  await recordUsage(params.tenantId, 'VOICE_MINUTES', minutes, call.id);

  return call;
}
