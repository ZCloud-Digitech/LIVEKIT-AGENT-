import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';
import { POST } from '../app/api/internal/call-session/route';
import { POST as clientCallsPost } from '../app/api/app/calls/route';
import { NextRequest } from 'next/server';

// Load environment from .env safely if running in test runner
if (!process.env.WORKER_API_SECRET) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

const WORKER_SECRET = process.env.WORKER_API_SECRET;
if (!WORKER_SECRET) {
  throw new Error('WORKER_API_SECRET environment variable is required to run acceptance tests.');
}

function createMockRequest(body: any, bearerToken?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (bearerToken !== undefined) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  }
  return new NextRequest('http://localhost:3000/api/internal/call-session', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function runCallSessionTests() {
  console.log('🔒 Running Phase 2B Strict Call Session & Atomicity Acceptance Tests...\n');

  // Fetch test fixtures
  const tenantA = await db.tenant.findFirst({ where: { name: 'Apex Dental Care' } });
  const tenantB = await db.tenant.findFirst({ where: { name: 'Metro Health Clinic' } });

  if (!tenantA || !tenantB) {
    throw new Error('Test tenants not found. Run database seed first.');
  }

  const agentA = await db.agent.findFirst({
    where: { tenantId: tenantA.id },
    include: { versions: { where: { isPublished: true }, take: 1 } },
  });

  const agentB = await db.agent.findFirst({
    where: { tenantId: tenantB.id },
    include: { versions: { where: { isPublished: true }, take: 1 } },
  });

  if (!agentA || !agentA.versions[0] || !agentB || !agentB.versions[0]) {
    throw new Error('Test Agents not found or have no published version.');
  }

  const publishedVersionA = agentA.versions[0];
  const publishedVersionB = agentB.versions[0];
  const uniqueRoom = `test_room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // --- Test 1: Authentication enforcement ---
  console.log('--- Test 1: Authentication enforcement ---');
  const missingAuthRes = await POST(createMockRequest({ tenantId: tenantA.id, agentId: agentA.id, roomName: uniqueRoom }));
  if (missingAuthRes.status !== 401) throw new Error(`Expected 401 for missing auth header, got ${missingAuthRes.status}`);
  console.log('✔ TEST 1a PASSED: Missing auth header rejected with 401.');

  const invalidAuthRes = await POST(createMockRequest({ tenantId: tenantA.id, agentId: agentA.id, roomName: uniqueRoom }, 'invalid_key_123'));
  if (invalidAuthRes.status !== 401) throw new Error(`Expected 401 for invalid auth token, got ${invalidAuthRes.status}`);
  console.log('✔ TEST 1b PASSED: Invalid auth token rejected with 401.');

  // --- Test 2: Validation of required fields ---
  console.log('\n--- Test 2: Required Fields Validation ---');
  const missingFieldsRes = await POST(createMockRequest({ tenantId: tenantA.id }, WORKER_SECRET));
  if (missingFieldsRes.status !== 400) throw new Error(`Expected 400 for missing agentId/roomName, got ${missingFieldsRes.status}`);
  console.log('✔ TEST 2 PASSED: Missing required fields rejected with 400.');

  // --- Test 3: Tenant Isolation ---
  console.log('\n--- Test 3: Tenant Isolation ---');
  const crossTenantRes = await POST(createMockRequest({
    tenantId: tenantB.id,
    agentId: agentA.id,
    roomName: uniqueRoom,
    durationSeconds: 60,
  }, WORKER_SECRET));
  if (crossTenantRes.status !== 404) throw new Error(`Expected 404 for cross-tenant agent reporting, got ${crossTenantRes.status}`);
  console.log('✔ TEST 3 PASSED: Cross-tenant call reporting rejected with 404 AGENT_NOT_FOUND.');

  // --- Test 4: Strict Agent Version Validation ---
  console.log('\n--- Test 4: Strict Agent Version Validation ---');
  // 4a. Nonexistent version
  const nonExistentVerRes = await POST(createMockRequest({
    tenantId: tenantA.id,
    agentId: agentA.id,
    agentVersionId: 'nonexistent_version_cuid_999',
    roomName: `${uniqueRoom}_badver`,
  }, WORKER_SECRET));
  if (nonExistentVerRes.status !== 400) throw new Error(`Expected 400 for nonexistent version, got ${nonExistentVerRes.status}`);
  console.log('✔ TEST 4a PASSED: Nonexistent agentVersionId rejected with 400 VERSION_INVALID.');

  // 4b. Cross-agent version (version belonging to agent B passed for agent A)
  const crossAgentVerRes = await POST(createMockRequest({
    tenantId: tenantA.id,
    agentId: agentA.id,
    agentVersionId: publishedVersionB.id,
    roomName: `${uniqueRoom}_crossver`,
  }, WORKER_SECRET));
  if (crossAgentVerRes.status !== 400) throw new Error(`Expected 400 for cross-agent version, got ${crossAgentVerRes.status}`);
  console.log('✔ TEST 4b PASSED: Cross-agent version rejected with 400 VERSION_INVALID.');

  // 4c. Unpublished draft version
  const draftVersion = await db.agentVersion.create({
    data: {
      agentId: agentA.id,
      versionNumber: 9999,
      changeSummary: 'Test draft version',
      isPublished: false,
    },
  });

  try {
    const unpublishedVerRes = await POST(createMockRequest({
      tenantId: tenantA.id,
      agentId: agentA.id,
      agentVersionId: draftVersion.id,
      roomName: `${uniqueRoom}_unpub`,
    }, WORKER_SECRET));
    if (unpublishedVerRes.status !== 400) throw new Error(`Expected 400 for unpublished version, got ${unpublishedVerRes.status}`);
    console.log('✔ TEST 4c PASSED: Unpublished agent version rejected with 400 VERSION_INVALID.');
  } finally {
    await db.agentVersion.delete({ where: { id: draftVersion.id } }).catch(() => {});
  }

  // --- Test 5: Transaction Atomicity & Rollback ---
  console.log('\n--- Test 5: Transaction Atomicity & Rollback ---');
  const rollbackRoom = `${uniqueRoom}_rollback`;
  const rollbackRes = await POST(createMockRequest({
    tenantId: tenantA.id,
    agentId: agentA.id,
    agentVersionId: publishedVersionA.id,
    roomName: rollbackRoom,
    durationSeconds: 90,
    transcripts: [{ speaker: 'AGENT', message: 'Hello' }],
    _simulateFailure: 'ROLLBACK',
  }, WORKER_SECRET));

  if (rollbackRes.status !== 500) throw new Error(`Expected 500 for simulated failure, got ${rollbackRes.status}`);
  const orphanedCall = await db.call.findFirst({ where: { livekitRoomId: rollbackRoom } });
  if (orphanedCall) throw new Error(`Transaction failed to rollback! Call ${orphanedCall.id} remained in DB.`);
  console.log('✔ TEST 5 PASSED: Transaction atomicity confirmed. Database rolled back completely on error.');

  // --- Test 6: Valid Call Persistence & Metering ---
  console.log('\n--- Test 6: Valid Call Ingestion & Persistence ---');
  const validCallPayload = {
    tenantId: tenantA.id,
    agentId: agentA.id,
    agentVersionId: publishedVersionA.id,
    roomName: uniqueRoom,
    callerIdentity: 'browser_test_user',
    durationSeconds: 125, // ceil(125 / 60) = 3 minutes
    status: 'COMPLETED',
    transcripts: [
      { speaker: 'AGENT', message: 'Hello! Welcome to Apex Dental.', timestampOffsetMs: 0 },
      { speaker: 'CUSTOMER', message: 'What time do you open tomorrow?', timestampOffsetMs: 3500 },
      { speaker: 'AGENT', message: 'We open at 9:00 AM.', timestampOffsetMs: 7200 },
    ],
  };

  const validRes = await POST(createMockRequest(validCallPayload, WORKER_SECRET));
  if (validRes.status !== 200) {
    const err = await validRes.json();
    throw new Error(`Expected 200 for valid call ingestion, got ${validRes.status}: ${JSON.stringify(err)}`);
  }

  const validJson = await validRes.json();
  const callId = validJson.data.callId;
  if (!validJson.success || !callId || validJson.data.billableMinutes !== 3) {
    throw new Error(`Invalid response payload: ${JSON.stringify(validJson)}`);
  }

  const dbCall = await db.call.findUnique({
    where: { id: callId },
    include: { transcripts: true },
  });
  if (!dbCall || dbCall.transcripts.length !== 3) {
    throw new Error('Call or transcripts not found in DB.');
  }

  const usageRecord = await db.usageRecord.findFirst({
    where: { callId, metricType: 'VOICE_MINUTES' },
  });
  if (!usageRecord || usageRecord.quantity !== 3) {
    throw new Error(`Expected UsageRecord with 3 minutes, found: ${JSON.stringify(usageRecord)}`);
  }
  console.log(`✔ TEST 6 PASSED: Atomic persistence and server-authoritative 3 min usage recorded for call ${callId}.`);

  // --- Test 7: Idempotency & Duplicate Prevention ---
  console.log('\n--- Test 7: Idempotency & Duplicate Prevention ---');
  const dupRes = await POST(createMockRequest(validCallPayload, WORKER_SECRET));
  if (dupRes.status !== 200) throw new Error(`Expected 200 for duplicate submission, got ${dupRes.status}`);
  const dupJson = await dupRes.json();
  if (dupJson.data.callId !== callId || dupJson.data.isDuplicate !== true) {
    throw new Error(`Idempotency failed: ${JSON.stringify(dupJson)}`);
  }

  const usageCount = await db.usageRecord.count({ where: { callId, metricType: 'VOICE_MINUTES' } });
  if (usageCount !== 1) throw new Error(`Duplicate submission created extra usage records! Count: ${usageCount}`);
  console.log('✔ TEST 7 PASSED: Duplicate session returned existing call with 0 duplicate usage records.');

  // --- Test 8: Client-Side Call Creation Restriction ---
  console.log('\n--- Test 8: Client-Side Call Creation Restriction ---');
  const clientRes = await clientCallsPost(new NextRequest('http://localhost:3000/api/app/calls', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ durationSeconds: 999 }),
  }));
  if (clientRes.status !== 403) throw new Error(`Expected 403 for client calls POST, got ${clientRes.status}`);
  console.log('✔ TEST 8 PASSED: Client-side POST /api/app/calls remains blocked with 403 Forbidden.');

  console.log('\n🎉 ALL Phase 2B Acceptance Tests PASSED!\n');
}

runCallSessionTests()
  .catch((err) => {
    console.error('❌ Acceptance Test Failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
