import { db } from '@/lib/db';
import { checkEntitlement } from '@/services/entitlement.service';
import { concurrencyService } from '@/services/concurrency.service';

export interface OutboundDispatchParams {
  tenantId: string;
  agentId: string;
  recipientNumber: string;
  callerId?: string;
  customerName?: string;
  customContext?: Record<string, any>;
  isTransactional?: boolean; // Transactional (appointment reminder, follow-up) vs Marketing
}

export interface OutboundDispatchResult {
  success: boolean;
  callId?: string;
  roomName?: string;
  errorCode?: string;
  errorMessage?: string;
}

export class OutboundService {
  /**
   * Database-level circuit breaker: checks if the last 5 outbound calls for this tenant all failed.
   */
  async isCircuitBreakerOpen(tenantId: string): Promise<boolean> {
    const recentCalls = await db.call.findMany({
      where: { tenantId, direction: 'OUTBOUND' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { status: true },
    });
    return recentCalls.length >= 5 && recentCalls.every((c) => c.status === 'FAILED');
  }

  /**
   * Checks whether the recipient is on the tenant's Do Not Call (DNC) or opt-out list.
   */
  async checkOptOut(tenantId: string, phone: string): Promise<boolean> {
    const customer = await db.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    if (!customer) return false;

    let tags: string[] = [];
    try {
      if (customer.tags) tags = JSON.parse(customer.tags);
    } catch {
      tags = [];
    }

    return tags.includes('OPTED_OUT') || tags.includes('DNC');
  }

  /**
   * Registers a customer's opt-out preference immediately in the database.
   */
  async registerOptOut(tenantId: string, phone: string, reason = 'User requested opt-out'): Promise<void> {
    const existing = await db.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    let tags: string[] = [];
    try {
      if (existing?.tags) tags = JSON.parse(existing.tags);
    } catch {
      tags = [];
    }

    if (!tags.includes('OPTED_OUT')) tags.push('OPTED_OUT');
    if (!tags.includes('DNC')) tags.push('DNC');

    await db.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {
        tags: JSON.stringify(tags),
        notes: existing?.notes ? `${existing.notes}\n[Opted Out]: ${reason}` : `[Opted Out]: ${reason}`,
      },
      create: {
        tenantId,
        phone,
        name: 'Opted-Out Caller',
        tags: JSON.stringify(tags),
        notes: `[Opted Out]: ${reason}`,
      },
    });
  }

  /**
   * Records explicit customer consent for future contact.
   */
  async recordConsent(tenantId: string, phone: string, name?: string, source = 'Web Form'): Promise<void> {
    const existing = await db.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    let tags: string[] = [];
    try {
      if (existing?.tags) tags = JSON.parse(existing.tags);
    } catch {
      tags = [];
    }

    // Remove any previous opt out
    tags = tags.filter((t) => t !== 'OPTED_OUT' && t !== 'DNC');
    if (!tags.includes('CONSENT_VERIFIED')) tags.push('CONSENT_VERIFIED');

    await db.customer.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      update: {
        name: name || existing?.name || 'Valued Patient',
        tags: JSON.stringify(tags),
      },
      create: {
        tenantId,
        phone,
        name: name || 'Valued Patient',
        tags: JSON.stringify(tags),
        notes: `[Consent Recorded]: Source ${source}`,
      },
    });
  }

  /**
   * Enforces TCPA and local permissible calling hours (default 9 AM to 8 PM local time).
   */
  isPermissibleCallingHour(timezone = 'America/New_York'): boolean {
    try {
      const now = new Date();
      const localTimeStr = now.toLocaleTimeString('en-US', { timeZone: timezone, hour12: false });
      const currentHour = parseInt(localTimeStr.split(':')[0], 10);
      return currentHour >= 9 && currentHour < 20; // 9:00 to 19:59
    } catch {
      return true; // Fallback to permissive if timezone parsing fails
    }
  }

  /**
   * Full outbound call dispatch pipeline with:
   * 1. Database-level circuit breaker guard
   * 2. Opt-out & DNC check
   * 3. Permissible calling hours verification
   * 4. Quota and entitlement verification
   * 5. Database-level atomic concurrency slot acquisition
   * 6. LiveKit room creation & Call record logging
   */
  async dispatchCall(params: OutboundDispatchParams): Promise<OutboundDispatchResult> {
    const { tenantId, agentId, recipientNumber, callerId, customerName, isTransactional } = params;

    // 1. Database-level Circuit Breaker Check
    const isCircuitOpen = await this.isCircuitBreakerOpen(tenantId);
    if (isCircuitOpen) {
      return {
        success: false,
        errorCode: 'CIRCUIT_BREAKER_OPEN',
        errorMessage: 'Outbound calling paused: Last 5 consecutive outbound calls failed. Check carrier configuration or destination numbers.',
      };
    }

    // 2. Opt-out & DNC check
    const isOptedOut = await this.checkOptOut(tenantId, recipientNumber);
    if (isOptedOut) {
      return {
        success: false,
        errorCode: 'RECIPIENT_OPTED_OUT',
        errorMessage: `Recipient ${recipientNumber} has opted out of automated communications.`,
      };
    }

    // 3. Permissible calling hours (skipped for transactional appointment reminders if urgent)
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!isTransactional && !this.isPermissibleCallingHour(tenant?.timezone || 'America/New_York')) {
      return {
        success: false,
        errorCode: 'OUTSIDE_CALLING_HOURS',
        errorMessage: `Calls are restricted to 9:00 AM - 8:00 PM in recipient timezone (${tenant?.timezone}).`,
      };
    }

    // 4. Voice minute quota check
    const quotaCheck = await checkEntitlement(tenantId, 'VOICE_MINUTES');
    if (!quotaCheck.allowed) {
      return {
        success: false,
        errorCode: 'QUOTA_EXCEEDED',
        errorMessage: 'Tenant voice minute quota has been exhausted. Please upgrade or top up credits.',
      };
    }

    // 5. Resolve valid agent ID
    let resolvedAgentId: string | null = null;
    if (agentId) {
      const agentRecord = await db.agent.findFirst({
        where: { id: agentId, tenantId },
      });
      if (agentRecord) resolvedAgentId = agentRecord.id;
    }
    if (!resolvedAgentId) {
      const defaultAgent = await db.agent.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      });
      resolvedAgentId = defaultAgent?.id || null;
    }

    const callRecord = await db.call.create({
      data: {
        tenantId,
        agentId: resolvedAgentId,
        callerNumber: callerId || tenant?.phone || '+15552345678',
        recipientNumber,
        callerName: customerName || 'Outbound Patient',
        direction: 'OUTBOUND',
        status: 'INITIATED',
        provider: 'Plivo',
      },
    });

    // 6. Database-level atomic concurrency slot acquisition
    const slot = await concurrencyService.acquireSlot(tenantId, callRecord.id);
    if (!slot.acquired) {
      await db.call.update({
        where: { id: callRecord.id },
        data: { status: 'FAILED', failureReason: slot.error },
      });
      return {
        success: false,
        callId: callRecord.id,
        errorCode: 'CONCURRENCY_LIMIT_EXCEEDED',
        errorMessage: slot.error,
      };
    }

    // 7. Validate LiveKit and Telephony Provider Credentials
    const livekitKey = process.env.LIVEKIT_API_KEY;
    const livekitSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;
    const isSimMode = process.env.SIP_SIMULATION_MODE === 'true';

    if (!livekitKey || !livekitSecret || !livekitUrl) {
      await concurrencyService.releaseSlot(callRecord.id, 'FAILED');
      await db.call.update({
        where: { id: callRecord.id },
        data: {
          status: 'FAILED',
          failureReason: 'LiveKit credentials (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) are missing.',
        },
      });
      return {
        success: false,
        callId: callRecord.id,
        errorCode: 'CONFIGURATION_ERROR',
        errorMessage: 'LiveKit server credentials are not properly configured for outbound dispatch.',
      };
    }

    // Resolve SIP Outbound Trunk
    const phoneNumber = await db.phoneNumber.findFirst({
      where: { tenantId, status: 'ACTIVE' },
    });
    const sipTrunkId = process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID || (phoneNumber as any)?.sipTrunkId;

    if (!isSimMode && !sipTrunkId) {
      await concurrencyService.releaseSlot(callRecord.id, 'FAILED');
      await db.call.update({
        where: { id: callRecord.id },
        data: {
          status: 'FAILED',
          failureReason: 'No LiveKit SIP Outbound Trunk configured (LIVEKIT_SIP_OUTBOUND_TRUNK_ID is missing).',
        },
      });
      return {
        success: false,
        callId: callRecord.id,
        errorCode: 'CONFIGURATION_ERROR',
        errorMessage: 'No LiveKit SIP Outbound Trunk is configured for outbound PSTN calls.',
      };
    }

    // 8. Initialize LiveKit room and dispatch outbound call session
    const roomName = `call_outbound_${tenantId.slice(-6)}_${callRecord.id.slice(-8)}`;
    const httpHost = livekitUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

    try {
      // 8a. Dispatch authoritative AI voice worker to the room
      try {
        const { AgentDispatchClient } = await import('livekit-server-sdk');
        const dispatchClient = new AgentDispatchClient(httpHost, livekitKey, livekitSecret);
        await dispatchClient.createDispatch(roomName, 'zcloud-ai-telecaller-agent', {
          metadata: JSON.stringify({
            tenantId,
            agentId,
            callId: callRecord.id,
            direction: 'OUTBOUND',
            recipientNumber,
            customerName: customerName || 'Outbound Patient',
          }),
        });
      } catch (agentDispatchErr: any) {
        console.warn(`[Outbound Service] Voice agent dispatch warning: ${agentDispatchErr.message}`);
      }

      // 8b. Dispatch SIP participant through LiveKit SIP Trunk if configured
      let sipCallId: string | undefined;
      if (!isSimMode && sipTrunkId) {
        const { SipClient } = await import('livekit-server-sdk');
        const sipClient = new SipClient(httpHost, livekitKey, livekitSecret);
        const sipInfo = await sipClient.createSipParticipant(sipTrunkId, recipientNumber, roomName, {
          fromNumber: callerId || phoneNumber?.number || tenant?.phone || undefined,
          participantIdentity: `sip_${recipientNumber.replace(/[^0-9]/g, '')}`,
          participantName: customerName || 'Outbound Patient',
          playDialtone: true,
          ringingTimeout: 45,
        });
        sipCallId = (sipInfo as any)?.sipCallId || (sipInfo as any)?.participantId;
      }

      // 8c. Update Call record to RINGING
      await db.call.update({
        where: { id: callRecord.id },
        data: {
          livekitRoomId: roomName,
          sipCallId: sipCallId || null,
          sipTrunkId: sipTrunkId || null,
          status: 'RINGING',
        },
      });

      // Record dispatch audit event
      await db.callEvent.create({
        data: {
          callId: callRecord.id,
          eventType: 'OUTBOUND_DISPATCHED',
          payload: JSON.stringify({
            recipientNumber,
            callerId: callerId || tenant?.phone,
            roomName,
            sipTrunkId: sipTrunkId || (isSimMode ? 'SIMULATED_TRUNK' : null),
            sipCallId: sipCallId || (isSimMode ? 'SIMULATED_CALL' : null),
            timestamp: new Date().toISOString(),
          }),
        },
      });

      return {
        success: true,
        callId: callRecord.id,
        roomName,
      };
    } catch (err: any) {
      await concurrencyService.releaseSlot(callRecord.id, 'FAILED');
      await db.call.update({
        where: { id: callRecord.id },
        data: {
          status: 'FAILED',
          failureReason: err.message || 'Telephony dispatch failed',
        },
      });
      return {
        success: false,
        callId: callRecord.id,
        errorCode: 'TELEPHONY_DISPATCH_FAILED',
        errorMessage: err.message || 'Failed to dispatch outbound call through LiveKit.',
      };
    }
  }
}

export const outboundService = new OutboundService();
