import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Authoritative Internal Call Session API
 * Ingests completed call sessions, duration, transcripts, and meters billable minutes.
 * Authenticated strictly via Authorization: Bearer <WORKER_API_SECRET>.
 *
 * Atomicity: Call, CallTranscript, and UsageRecord are persisted in a single Prisma transaction.
 * Strict Versioning: Validates that agentVersionId exists, belongs to agentId, and is published.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via WORKER_API_SECRET
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const expectedSecret = process.env.WORKER_API_SECRET;

    const crypto = await import('crypto');
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expectedSecret || '');
    const isSecretValid =
      Boolean(expectedSecret) &&
      Boolean(token) &&
      tokenBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(tokenBuf, expectedBuf);

    if (!isSecretValid) {
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
      agentVersionId,
      roomName,
      callerIdentity,
      callerNumber,
      callerName,
      direction,
      startedAt,
      endedAt,
      durationSeconds,
      status,
      intent,
      outcome,
      summary,
      sentiment,
      transcripts,
      _simulateFailure, // test-only flag to verify transaction rollback
    } = body;

    if (!tenantId || !agentId || !roomName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'tenantId, agentId, and roomName are required fields.',
          },
        },
        { status: 400 }
      );
    }

    // 3. Verify tenant exists and is active/trial
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
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

    // 4. Verify agent belongs to tenant
    const agent = await db.agent.findFirst({
      where: { id: agentId, tenantId },
      select: { id: true, name: true, currentVersionId: true },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AGENT_NOT_FOUND',
            message: `Agent ${agentId} not found for tenant ${tenantId}.`,
          },
        },
        { status: 404 }
      );
    }

    // 5. Strict Agent Version Validation
    let effectiveVersionId: string;
    if (agentVersionId) {
      const version = await db.agentVersion.findFirst({
        where: {
          id: agentVersionId,
          agentId,
          isPublished: true,
        },
      });

      if (!version) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VERSION_INVALID',
              message: `Agent version ${agentVersionId} is invalid, unpublished, or does not belong to agent ${agentId}.`,
            },
          },
          { status: 400 }
        );
      }
      effectiveVersionId = version.id;
    } else {
      // Version omitted: fallback to agent's current published version
      if (!agent.currentVersionId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VERSION_REQUIRED',
              message: `Agent ${agentId} has no active current version.`,
            },
          },
          { status: 400 }
        );
      }

      const currentVersion = await db.agentVersion.findFirst({
        where: {
          id: agent.currentVersionId,
          agentId,
          isPublished: true,
        },
      });

      if (!currentVersion) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VERSION_UNPUBLISHED',
              message: `Agent ${agentId} current version is not published.`,
            },
          },
          { status: 400 }
        );
      }
      effectiveVersionId = currentVersion.id;
    }

    // 6. Idempotency Check: prevent duplicate call session ingestion
    const existingCall = await db.call.findFirst({
      where: { livekitRoomId: roomName, tenantId },
      include: { transcripts: true },
    });

    // If call is already finalized or has transcripts recorded, return idempotent response
    if (existingCall && (existingCall.status === 'COMPLETED' || existingCall.transcripts.length > 0)) {
      const billableMin = Math.ceil(existingCall.durationSeconds / 60);
      return NextResponse.json({
        success: true,
        data: {
          callId: existingCall.id,
          durationSeconds: existingCall.durationSeconds,
          billableMinutes: billableMin,
          transcriptCount: existingCall.transcripts.length,
          isDuplicate: true,
        },
      });
    }

    // 7. Calculate timestamps and duration
    const parsedDuration = typeof durationSeconds === 'number' ? Math.max(0, Math.round(durationSeconds)) : 0;
    const callStart = startedAt ? new Date(startedAt) : new Date(Date.now() - parsedDuration * 1000);
    const callEnd = endedAt ? new Date(endedAt) : new Date();
    const billableMinutes = parsedDuration > 0 ? Math.ceil(parsedDuration / 60) : 0;

    // 8. Atomic Persistence: Call, CallTranscript, and UsageRecord in ONE transaction
    const transactionResult = await db.$transaction(async (tx) => {
      // 8a. Create or finalize authoritative Call record
      let call;
      if (existingCall) {
        call = await tx.call.update({
          where: { id: existingCall.id },
          data: {
            agentVersionId: effectiveVersionId,
            callerNumber: callerNumber || existingCall.callerNumber,
            callerName: callerName || existingCall.callerName,
            status: status || 'COMPLETED',
            durationSeconds: parsedDuration,
            intent: intent || existingCall.intent || 'Voice Telecaller Session',
            outcome: outcome || existingCall.outcome || 'RESOLVED',
            summary: summary || (transcripts?.length ? `Voice call completed with ${transcripts.length} transcript turns.` : 'Voice call completed.'),
            sentiment: sentiment || 'NEUTRAL',
            endedAt: callEnd,
          },
        });
      } else {
        call = await tx.call.create({
          data: {
            tenantId,
            agentId,
            agentVersionId: effectiveVersionId,
            callerNumber: callerNumber || (callerIdentity ? `+1-${callerIdentity}` : '+1 (555) 019-LIVE'),
            callerName: callerName || callerIdentity || 'LiveKit Voice Caller',
            direction: direction || 'INBOUND',
            status: status || 'COMPLETED',
            durationSeconds: parsedDuration,
            intent: intent || 'Voice Telecaller Session',
            outcome: outcome || 'RESOLVED',
            summary: summary || (transcripts?.length ? `Voice call completed with ${transcripts.length} transcript turns.` : 'Voice call completed.'),
            sentiment: sentiment || 'NEUTRAL',
            livekitRoomId: roomName,
            startedAt: callStart,
            endedAt: callEnd,
          },
        });
      }

      // 8b. Persist transcripts if provided
      let tCount = 0;
      if (Array.isArray(transcripts) && transcripts.length > 0) {
        await tx.callTranscript.createMany({
          data: transcripts.map((t: any) => ({
            callId: call.id,
            speaker: t.speaker === 'AGENT' ? 'AGENT' : t.speaker === 'SYSTEM' ? 'SYSTEM' : 'CUSTOMER',
            message: String(t.message || ''),
            toolInvocation: t.toolInvocation ? String(t.toolInvocation) : null,
            toolResult: t.toolResult ? String(t.toolResult) : null,
            latencyMs: typeof t.latencyMs === 'number' ? t.latencyMs : null,
            timestampOffsetMs: typeof t.timestampOffsetMs === 'number' ? Math.round(t.timestampOffsetMs) : 0,
          })),
        });
        tCount = transcripts.length;
      }

      // 8c. Server-authoritative billable minutes calculation and atomic quota deduction
      if (billableMinutes > 0) {
        const usageKey = `usage_${call.id}_VOICE_MINUTES`;
        const existingUsage = await tx.usageRecord.findFirst({
          where: {
            tenantId,
            metricType: 'VOICE_MINUTES',
            OR: [{ slotKey: usageKey }, { callId: call.id }],
          },
        });
        if (!existingUsage) {
          await tx.usageRecord.create({
            data: {
              tenantId,
              metricType: 'VOICE_MINUTES',
              quantity: billableMinutes,
              callId: call.id,
              slotKey: usageKey,
              idempotencyKey: usageKey,
            },
          });
        }
      }

      // Test hook to verify atomicity rollback
      if (_simulateFailure === 'ROLLBACK') {
        throw new Error('Simulated transaction rollback error.');
      }

      return {
        callId: call.id,
        durationSeconds: call.durationSeconds,
        billableMinutes,
        transcriptCount: tCount,
        isDuplicate: false,
      };
    });

    return NextResponse.json({
      success: true,
      data: transactionResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message || 'An unexpected error occurred while saving call session.',
        },
      },
      { status: 500 }
    );
  }
}
