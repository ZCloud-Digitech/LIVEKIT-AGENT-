import jwt from 'jsonwebtoken';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { checkEntitlement } from './entitlement.service';

export interface LiveKitSessionRequest {
  tenantId: string;
  agentId: string;
  agentVersionId?: string;
  environment: 'development' | 'staging' | 'production';
  participantName?: string;
  isTestSession?: boolean;
}

export interface LiveKitTokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  sessionId: string;
  dispatchId?: string;
  metadata: {
    tenantId: string;
    agentId: string;
    agentVersionId?: string;
    isTestSession: boolean;
    environment: string;
  };
  expiresAt: string;
}

/**
 * Server-side LiveKit Session, Token Generator & Agent Dispatcher
 * - Enforces tenant limits prior to token generation.
 * - Cryptographically signs access tokens server-side without leaking LiveKit API secrets.
 * - Dispatches the authoritative Python voice worker ('zcloud-ai-telecaller-agent') to the room.
 */
export async function createLiveKitSessionToken(
  params: LiveKitSessionRequest
): Promise<LiveKitTokenResponse> {
  const { tenantId, agentId, agentVersionId, environment, participantName, isTestSession } = params;

  // 1. Enforce usage limits server-side
  const entitlement = await checkEntitlement(tenantId, 'VOICE_MINUTES');
  if (!entitlement.allowed) {
    throw new Error('Monthly voice minutes quota exceeded for this tenant. Please upgrade your plan.');
  }

  const livekitKey = process.env.LIVEKIT_API_KEY;
  const livekitSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!livekitKey || !livekitSecret || !livekitUrl) {
    throw new Error('LiveKit server credentials are not properly configured. LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set in the server environment.');
  }

  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const roomName = `room_${tenantId.substring(0, 8)}_${agentId.substring(0, 8)}_${sessionId.substring(5, 11)}`;

  const metadata = {
    tenantId,
    agentId,
    agentVersionId,
    isTestSession: !!isTestSession,
    environment,
    sessionId,
  };

  // 2. Dispatch the authoritative Python voice worker ('zcloud-ai-telecaller-agent') to the room
  let dispatchId: string | undefined;
  try {
    const httpHost = livekitUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    const dispatchClient = new AgentDispatchClient(httpHost, livekitKey, livekitSecret);
    const dispatch = await dispatchClient.createDispatch(roomName, 'zcloud-ai-telecaller-agent', {
      metadata: JSON.stringify(metadata),
    });
    dispatchId = dispatch.id;
    console.log(`[LiveKit Dispatch] Successfully dispatched agent 'zcloud-ai-telecaller-agent' to room '${roomName}' (dispatchId: ${dispatchId})`);
  } catch (dispatchErr: any) {
    console.warn(`[LiveKit Dispatch] Notice: Explicit agent dispatch could not be created for room ${roomName}: ${dispatchErr.message}`);
  }

  // 3. Construct standard LiveKit payload
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour validity

  const tokenPayload = {
    iss: livekitKey,
    sub: participantName || `client_${sessionId.substring(5, 10)}`,
    nbf: now,
    exp: exp,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
    metadata: JSON.stringify(metadata),
  };

  const token = jwt.sign(tokenPayload, livekitSecret);

  return {
    token,
    wsUrl: livekitUrl,
    roomName,
    sessionId,
    dispatchId,
    metadata,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
