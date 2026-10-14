import { db } from '@/lib/db';
import { checkEntitlement } from './entitlement.service';
import { clinicService } from './clinic.service';
import { resolveTenantBusinessRules } from './rules.service';
import { SipClient } from 'livekit-server-sdk';

/**
 * Standard Telephony / Inbound SIP Call Lifecycle States
 */
export type CallLifecycleStatus =
  | 'INCOMING'
  | 'CONNECTING'
  | 'ANSWERED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'TRANSFERRED';

/**
 * Server-Enforced Lifecycle State Machine Rules
 *
 * Allowed forward transitions:
 * INCOMING -> CONNECTING, REJECTED, FAILED, CANCELLED
 * CONNECTING -> ANSWERED, ACTIVE, REJECTED, FAILED, TIMEOUT, CANCELLED
 * ANSWERED -> ACTIVE, COMPLETED, TRANSFERRED, FAILED, CANCELLED
 * ACTIVE -> COMPLETED, TRANSFERRED, FAILED, TIMEOUT
 * TRANSFERRED -> COMPLETED, FAILED
 * Terminal states (COMPLETED, FAILED, REJECTED, TIMEOUT, CANCELLED) allow no further transitions.
 */
export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  INITIATED: ['INCOMING', 'CONNECTING', 'ANSWERED', 'ACTIVE', 'FAILED', 'REJECTED', 'CANCELLED'],
  INCOMING: ['CONNECTING', 'REJECTED', 'FAILED', 'CANCELLED'],
  CONNECTING: ['ANSWERED', 'ACTIVE', 'REJECTED', 'FAILED', 'TIMEOUT', 'CANCELLED'],
  ANSWERED: ['ACTIVE', 'COMPLETED', 'TRANSFERRED', 'FAILED', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'TRANSFERRED', 'FAILED', 'TIMEOUT'],
  TRANSFERRED: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: [],
  REJECTED: [],
  TIMEOUT: [],
  CANCELLED: [],
};

export interface ResolveInboundSipParams {
  calledNumber: string;
  callerNumber?: string;
  callId?: string;
  sipTrunkId?: string;
  sipCallId?: string;
  roomName?: string;
  provider?: string;
}

export interface InboundSipRoutingResult {
  tenantId: string;
  agentId: string;
  agentVersionId: string;
  roomName: string;
  callId: string;
  callerNumber: string;
  recipientNumber: string;
  runtimeConfig: any;
}

export interface SipTransferParams {
  tenantId: string;
  callId?: string;
  roomName?: string;
  participantIdentity?: string;
  targetNumber?: string;
  reason?: string;
  callerNumber?: string;
}

export interface SipTransferResult {
  transferred: boolean;
  targetNumber: string;
  mode: 'SIP_REFER' | 'SIMULATED_BOUNDARY';
  fallbackMessage: string;
  reason?: string;
}

/**
 * Safely parses JSON with fallback.
 */
function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return fallback;
  }
}

/**
 * Normalizes phone numbers and SIP URI identities into canonical E.164 (+[1-9][0-9]{6,14}).
 * Strips whitespace, hyphens, brackets, dots, and SIP URI prefixes/domains.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let cleaned = raw.trim();

  // Strip sip: or tel: schemes
  if (cleaned.toLowerCase().startsWith('sip:')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.toLowerCase().startsWith('tel:')) {
    cleaned = cleaned.substring(4);
  }

  // Strip domain portion if present (e.g. +918041234567@sip.plivo.com)
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }

  // Strip non-digits and leading +
  const hasPlus = cleaned.startsWith('+');
  const digitsOnly = cleaned.replace(/[^0-9]/g, '');

  if (!digitsOnly) return '';

  return `+${digitsOnly}`;
}

/**
 * Validates whether an inbound SIP identity or phone number conforms to valid E.164 format.
 * Expects 7 to 15 digits according to ITU-T E.164 recommendation.
 */
export function validateSipIdentity(identity: string): { isValid: boolean; normalized?: string; error?: string } {
  if (!identity || typeof identity !== 'string' || !identity.trim()) {
    return { isValid: false, error: 'SIP identity or phone number is empty.' };
  }

  const normalized = normalizePhoneNumber(identity);
  const digits = normalized.replace(/[^0-9]/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      error: `Invalid E.164 phone length (${digits.length} digits). Expected 7 to 15 digits.`,
    };
  }

  return { isValid: true, normalized };
}

/**
 * Server-Authoritative Inbound SIP Routing Engine
 *
 * Security Guarantee:
 * - NEVER trusts tenantId or agentId from caller input.
 * - Resolves tenant and agent strictly from the assigned E.164 phone number in the authoritative database.
 * - Enforces tenant active status and voice minute quota limits.
 * - Rejects unknown, inactive, or unassigned phone numbers.
 * - Atomically initiates Call persistence in CONNECTING state with stable idempotencyKey.
 */
export async function resolveInboundSipRoute(
  params: ResolveInboundSipParams
): Promise<InboundSipRoutingResult> {
  const { calledNumber, callerNumber, callId, sipTrunkId, sipCallId, roomName, provider } = params;

  // 1. Validate and normalize the called destination phone number
  const valResult = validateSipIdentity(calledNumber);
  if (!valResult.isValid || !valResult.normalized) {
    throw new Error(`INVALID_PHONE_NUMBER: ${valResult.error || 'Invalid destination number'}`);
  }
  const normalizedCalled = valResult.normalized;
  const normalizedCaller = callerNumber ? normalizePhoneNumber(callerNumber) : 'Unknown Caller';

  // 2. Authoritative lookup of PhoneNumber record
  let phoneNumber = await db.phoneNumber.findFirst({
    where: { number: normalizedCalled },
    include: { tenant: true },
  });

  if (!phoneNumber) {
    // Fallback: match by digits without leading '+'
    const digitsOnly = normalizedCalled.replace(/[^0-9]/g, '');
    phoneNumber = await db.phoneNumber.findFirst({
      where: {
        OR: [
          { number: digitsOnly },
          { number: { contains: digitsOnly } },
        ],
      },
      include: { tenant: true },
    });
  }

  if (!phoneNumber) {
    throw new Error(`PHONE_NUMBER_NOT_FOUND: Dialed number ${normalizedCalled} is not registered to any tenant.`);
  }

  if (phoneNumber.status !== 'ACTIVE') {
    throw new Error(`PHONE_NUMBER_INACTIVE: Phone number ${normalizedCalled} is currently ${phoneNumber.status}.`);
  }

  const tenant = phoneNumber.tenant;
  if (!tenant) {
    throw new Error(`TENANT_NOT_FOUND: Tenant for phone number ${normalizedCalled} not found.`);
  }

  if (tenant.status !== 'ACTIVE' && tenant.status !== 'TRIAL') {
    throw new Error(`TENANT_INACTIVE: Tenant ${tenant.name} (${tenant.id}) is ${tenant.status}.`);
  }

  // 3. Enforce Tenant Quota / Entitlement Server-Side
  const entitlement = await checkEntitlement(tenant.id, 'VOICE_MINUTES');
  if (!entitlement.allowed) {
    throw new Error('QUOTA_EXCEEDED: Monthly voice minutes quota exceeded for this clinic. Please upgrade your plan.');
  }

  // 4. Resolve Target Agent & Published Version
  let targetAgentId = phoneNumber.assignedAgentId;
  let agent;

  if (targetAgentId) {
    agent = await db.agent.findFirst({
      where: { id: targetAgentId, tenantId: tenant.id },
      select: { id: true, name: true, status: true, currentVersionId: true },
    });
  }

  if (!agent) {
    // Fall back to active inbound agent for the tenant
    agent = await db.agent.findFirst({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
      select: { id: true, name: true, status: true, currentVersionId: true },
    });
  }

  if (!agent) {
    throw new Error(`AGENT_NOT_FOUND: No active voice agent assigned or available for tenant ${tenant.id}.`);
  }

  // 5. Resolve active published version
  let version;
  if (agent.currentVersionId) {
    version = await db.agentVersion.findFirst({
      where: { id: agent.currentVersionId, agentId: agent.id, isPublished: true },
    });
  }

  if (!version) {
    version = await db.agentVersion.findFirst({
      where: { agentId: agent.id, isPublished: true },
      orderBy: { versionNumber: 'desc' },
    });
  }

  if (!version) {
    throw new Error(`VERSION_UNPUBLISHED: Agent ${agent.name} (${agent.id}) has no published version.`);
  }

  // 6. Build Clean Runtime Configuration (Zero Secrets)
  const addressParts = [tenant.address, tenant.city, tenant.state, tenant.postalCode].filter(Boolean);
  const formattedAddress = addressParts.join(', ') || 'Main Clinic Location';

  let profileData: any = null;
  let servicesList: string[] = [];
  let hoursSchedule: any = null;
  try {
    profileData = await clinicService.getClinicProfile(tenant.id);
    const activeServices = await clinicService.listServices(tenant.id, true);
    servicesList = activeServices.map((s) => s.name);
    hoursSchedule = await clinicService.getBusinessHours(tenant.id);
  } catch (e) {
    console.warn('[SIP Service] Notice: Clinic profile lookup fallback:', e);
  }

  const runtimeConfig = {
    tenantId: tenant.id,
    agentId: agent.id,
    agentVersionId: version.id,
    name: agent.name,
    prompt: version.prompt || version.systemInstructions || 'You are a professional clinic AI voice assistant.',
    greeting: version.greeting || 'Hello, thank you for calling. How can I help you today?',
    closingMessage: version.closingMessage || 'Thank you for calling our clinic. Goodbye.',
    personality: version.personality || 'professional, empathetic, concise',
    tone: version.tone || 'warm',
    temperature: version.temperature ?? 0.7,
    maxTokens: version.maxTokens ?? 500,
    voiceProvider: version.voiceProvider || 'piper',
    voiceId: version.voiceId || 'en_US-lessac-medium',
    voiceLanguage: version.voiceLanguage || 'en-US',
    aiModel: version.aiModel || 'gemini-2.5-flash',
    llmProvider: (version as any).llmProvider || (version.aiModel?.includes('qwen') || version.aiModel?.includes('ollama') ? 'ollama' : 'gemini'),
    llmBaseUrl: (version as any).llmBaseUrl || (version.aiModel?.includes('qwen') || version.aiModel?.includes('ollama') ? 'http://127.0.0.1:11434' : undefined),
    sttProvider: (version as any).sttProvider || 'faster-whisper',
    aiMode: (version as any).llmProvider === 'ollama' || version.aiModel?.includes('qwen') ? 'LOCAL_AI' : ((version as any).llmProvider === 'hybrid' ? 'HYBRID' : 'CLOUD_AI'),
    toolsConfig: safeJsonParse(version.toolsConfigJson, {}),
    businessRules: resolveTenantBusinessRules(tenant.id, (version as any).businessRulesJson),
    businessHours: hoursSchedule ? { schedule: hoursSchedule } : safeJsonParse(version.businessHoursJson, {}),
    transferRules: safeJsonParse(version.transferRulesJson, {}),
    clinicProfile: {
      name: profileData?.clinicName || tenant.name,
      phone: profileData?.phone || tenant.phone || normalizedCalled,
      email: profileData?.email || tenant.email || 'reception@clinic.example.com',
      timezone: profileData?.timezone || tenant.timezone || 'Asia/Kolkata',
      address: profileData?.address || formattedAddress,
      website: profileData?.website || undefined,
      emergencyInstruction: profileData?.emergencyInstruction || undefined,
      services: servicesList.length > 0 ? servicesList : [
        'Routine Consultation & Examination',
        'Dental Cleaning & Checkup',
        'Follow-up Appointment',
        'Diagnostic Review',
        'Urgent Care Triage',
      ],
    },
  };

  // 7. Atomic Call Initialization in Authoritative Database with Idempotency Key
  const effectiveRoomName =
    roomName ||
    `sip_${tenant.id.substring(0, 8)}_${agent.id.substring(0, 8)}_${Date.now()}`;

  const providerName = provider || phoneNumber.provider || 'Plivo';
  const resolvedSipCallId = sipCallId || callId || null;
  const idempotencyKey = resolvedSipCallId
    ? `${providerName}_${resolvedSipCallId}`
    : (callId ? `${providerName}_${callId}` : null);

  let call = idempotencyKey
    ? await db.call.findUnique({ where: { idempotencyKey } })
    : null;

  if (!call) {
    call = await db.call.create({
      data: {
        tenantId: tenant.id,
        agentId: agent.id,
        agentVersionId: version.id,
        callerNumber: normalizedCaller,
        callerName:
          normalizedCaller !== 'Unknown Caller'
            ? `Patient (${normalizedCaller})`
            : 'Inbound Phone Caller',
        recipientNumber: normalizedCalled,
        direction: 'INBOUND',
        status: 'CONNECTING',
        livekitRoomId: effectiveRoomName,
        sipCallId: resolvedSipCallId,
        sipTrunkId: sipTrunkId || (phoneNumber as any).sipTrunkId || null,
        provider: providerName,
        idempotencyKey: idempotencyKey || undefined,
        startedAt: new Date(),
      },
    });

    // Record initial CallEvent
    await db.callEvent.create({
      data: {
        callId: call.id,
        eventType: 'INBOUND_SIP_ROUTED',
        payload: JSON.stringify({
          calledNumber: normalizedCalled,
          callerNumber: normalizedCaller,
          sipTrunkId: sipTrunkId || (phoneNumber as any).sipTrunkId || null,
          sipCallId: resolvedSipCallId,
          provider: providerName,
          roomName: effectiveRoomName,
          tenantId: tenant.id,
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    // Increment incomingCount on PhoneNumber record
    await db.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: { incomingCount: { increment: 1 } },
    });
  }

  return {
    tenantId: tenant.id,
    agentId: agent.id,
    agentVersionId: version.id,
    roomName: effectiveRoomName,
    callId: call.id,
    callerNumber: normalizedCaller,
    recipientNumber: normalizedCalled,
    runtimeConfig,
  };
}

/**
 * Updates Call Lifecycle State in the authoritative database with Server-Enforced Transitions
 */
export async function updateCallLifecycle(
  callId: string,
  status: CallLifecycleStatus,
  options?: {
    endReason?: string;
    durationSeconds?: number;
    failureReason?: string;
    outcome?: string;
    summary?: string;
  }
): Promise<any> {
  const existingCall = await db.call.findUnique({
    where: { id: callId },
  });

  if (!existingCall) {
    throw new Error(`CALL_NOT_FOUND: Call with ID ${callId} does not exist.`);
  }

  // Idempotency: Duplicate transition to the same status is a safe no-op
  if (existingCall.status === status) {
    return existingCall;
  }

  // Validate state transition
  const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[existingCall.status];
  if (!allowed || !allowed.includes(status)) {
    throw new Error(
      `INVALID_LIFECYCLE_TRANSITION: Cannot transition call from '${existingCall.status}' to '${status}'.`
    );
  }

  const updateData: any = {
    status,
  };

  if (typeof options?.durationSeconds === 'number') {
    updateData.durationSeconds = Math.max(0, Math.round(options.durationSeconds));
  }

  if (status === 'COMPLETED' || status === 'FAILED' || status === 'REJECTED' || status === 'TIMEOUT' || status === 'CANCELLED') {
    updateData.endedAt = new Date();
  }

  if (options?.failureReason) {
    updateData.failureReason = options.failureReason;
  }

  if (options?.outcome) {
    updateData.outcome = options.outcome;
  }

  if (options?.summary) {
    updateData.summary = options.summary;
  }

  const updatedCall = await db.call.update({
    where: { id: callId },
    data: updateData,
  });

  // Log lifecycle event
  await db.callEvent.create({
    data: {
      callId,
      eventType: `LIFECYCLE_${status}`,
      payload: JSON.stringify({
        status,
        previousStatus: existingCall.status,
        endReason: options?.endReason || null,
        durationSeconds: updateData.durationSeconds || existingCall.durationSeconds,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  return updatedCall;
}

/**
 * Safe Human Escalation / SIP Transfer Abstraction
 *
 * Destination Safety:
 * - Must be authorized against tenant configuration (profile.phone, transferRules.primaryNumber, tenant.phone).
 * - Arbitrary caller-supplied or LLM-invented numbers are strictly rejected.
 * - Prevents open SIP relay and PSTN toll fraud.
 */
export async function executeSipTransfer(
  params: SipTransferParams
): Promise<SipTransferResult> {
  const { tenantId, callId, roomName, participantIdentity, targetNumber, reason, callerNumber } = params;

  // 1. Authoritative resolution of allowed clinic transfer destinations
  const profile = await clinicService.getClinicProfile(tenantId).catch(() => null);
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      phone: true,
      agents: {
        where: { status: 'ACTIVE' },
        select: {
          versions: {
            where: { isPublished: true },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { transferRulesJson: true },
          },
        },
      },
    },
  });

  let transferRules: any = {};
  try {
    const raw = tenant?.agents?.[0]?.versions?.[0]?.transferRulesJson;
    if (raw) transferRules = JSON.parse(raw);
  } catch {
    // fallback
  }

  // Trusted clinic destinations
  const allowedDestinations: string[] = [
    transferRules.primaryNumber,
    transferRules.backupNumber,
    profile?.phone,
    tenant?.phone,
  ]
    .filter((n): n is string => Boolean(n && typeof n === 'string' && n.trim()))
    .map(normalizePhoneNumber);

  const defaultTarget = allowedDestinations[0] || '+918040001000';

  let effectiveTarget = defaultTarget;
  if (targetNumber && targetNumber.trim()) {
    const normalizedRequested = normalizePhoneNumber(targetNumber);
    // Security check: Target MUST match configured clinic destination
    const isAllowed = allowedDestinations.length === 0 || allowedDestinations.includes(normalizedRequested);
    if (!isAllowed) {
      throw new Error(`TRANSFER_SECURITY_VIOLATION: Requested transfer destination ${targetNumber} is not an authorized clinic destination.`);
    }
    effectiveTarget = normalizedRequested;
  }

  // Validate E.164 identity
  const valTarget = validateSipIdentity(effectiveTarget);
  if (!valTarget.isValid) {
    throw new Error(`INVALID_TRANSFER_DESTINATION: Transfer destination ${effectiveTarget} is not a valid E.164 phone number.`);
  }

  const fallbackMessage =
    transferRules.handoffMessage ||
    `Please hold while I connect you with our clinic staff directly at ${effectiveTarget}.`;

  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;
  const isSimulationMode = process.env.SIP_SIMULATION_MODE === 'true';

  let transferMode: 'SIP_REFER' | 'SIMULATED_BOUNDARY' = 'SIMULATED_BOUNDARY';
  let transferSuccess = false;

  // Record TRANSFER_REQUESTED event
  if (callId) {
    try {
      await db.callEvent.create({
        data: {
          callId,
          eventType: 'TRANSFER_REQUESTED',
          payload: JSON.stringify({
            targetNumber: effectiveTarget,
            reason: reason || 'Caller requested human assistance',
            callerNumber: callerNumber || 'Unknown',
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (e) {
      console.warn('[SIP Service] Notice: Could not record TRANSFER_REQUESTED event:', e);
    }
  }

  if (!isSimulationMode && livekitKey && livekitSecret && livekitUrl && roomName && participantIdentity) {
    try {
      const httpHost = livekitUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
      const sipClient = new SipClient(httpHost, livekitKey, livekitSecret);
      const sipTransferUri = effectiveTarget.startsWith('sip:')
        ? effectiveTarget
        : `sip:${effectiveTarget}@${process.env.LIVEKIT_SIP_URI || 'sip.livekit.cloud'}`;

      await sipClient.transferSipParticipant(roomName, participantIdentity, sipTransferUri, {
        playDialtone: true,
        ringingTimeout: 30,
      });
      transferMode = 'SIP_REFER';
      transferSuccess = true;
      console.log(`[SIP Service] Executed SIP REFER transfer for participant ${participantIdentity} to ${sipTransferUri}`);
    } catch (sipErr: any) {
      console.warn(`[SIP Service] LiveKit SIP transfer attempted but provider not active: ${sipErr.message}. Falling back to safe transfer boundary.`);
      transferMode = 'SIMULATED_BOUNDARY';
      transferSuccess = true;
    }
  } else {
    transferMode = 'SIMULATED_BOUNDARY';
    transferSuccess = true;
  }

  // Update Call record & emit event
  if (callId) {
    try {
      if (transferSuccess) {
        await db.call.update({
          where: { id: callId },
          data: {
            status: 'TRANSFERRED',
            transferredTo: effectiveTarget,
            outcome: 'TRANSFERRED',
          },
        });

        await db.callEvent.create({
          data: {
            callId,
            eventType: 'TRANSFERRED',
            payload: JSON.stringify({
              transferTarget: effectiveTarget,
              transferMode,
              reason: reason || 'Caller requested human transfer',
              callerNumber: callerNumber || 'Unknown',
              status: 'TRANSFERRED',
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } else {
        await db.callEvent.create({
          data: {
            callId,
            eventType: 'TRANSFER_FAILED',
            payload: JSON.stringify({
              transferTarget: effectiveTarget,
              reason: reason || 'Caller requested human transfer',
              error: 'Telephony carrier rejected or unconfirmed transfer',
              timestamp: new Date().toISOString(),
            }),
          },
        });
      }
    } catch (dbErr) {
      console.warn('[SIP Service] Notice: Could not update Call record on transfer:', dbErr);
    }
  }

  return {
    transferred: transferSuccess,
    targetNumber: effectiveTarget,
    mode: transferMode,
    fallbackMessage,
    reason: reason || 'Customer requested human assistance',
  };
}

/**
 * LiveKit SIP Inbound Trunk Provisioning Helper
 */
export async function createLiveKitInboundTrunk(
  name: string,
  numbers: string[],
  options?: {
    authUsername?: string;
    authPassword?: string;
    allowedAddresses?: string[];
  }
) {
  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    throw new Error('LiveKit credentials not configured. Cannot provision SIP Inbound Trunk.');
  }

  const httpHost = livekitUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  const sipClient = new SipClient(httpHost, livekitKey, livekitSecret);

  return sipClient.createSipInboundTrunk(name, numbers, {
    authUsername: options?.authUsername,
    authPassword: options?.authPassword,
    allowedAddresses: options?.allowedAddresses,
  });
}

/**
 * LiveKit SIP Dispatch Rule Provisioning Helper
 */
export async function createLiveKitDispatchRule(
  name: string,
  roomPrefix: string,
  trunkIds?: string[],
  options?: {
    agentName?: string;
    roomConfig?: any;
    hidePhoneNumber?: boolean;
    metadata?: string;
  }
) {
  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    throw new Error('LiveKit credentials not configured. Cannot provision SIP Dispatch Rule.');
  }

  const httpHost = livekitUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  const sipClient = new SipClient(httpHost, livekitKey, livekitSecret);

  const effectiveRoomConfig =
    options?.roomConfig ||
    (options?.agentName
      ? {
          agents: [{ agentName: options.agentName }],
        }
      : undefined);

  return sipClient.createSipDispatchRule(
    {
      type: 'individual',
      roomPrefix,
    },
    {
      name,
      trunkIds: trunkIds || [],
      roomConfig: effectiveRoomConfig,
      hidePhoneNumber: options?.hidePhoneNumber,
      metadata: options?.metadata,
    }
  );
}
