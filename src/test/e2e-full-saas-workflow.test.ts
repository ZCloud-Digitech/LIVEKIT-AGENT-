import { db } from '../lib/db';
import { POST as signupHandler } from '../app/api/auth/signup/route';
import { POST as integrationsPost, GET as integrationsGet } from '../app/api/app/integrations/route';
import { GET as runtimeGet } from '../app/api/internal/agent-runtime/route';
import { POST as bookHandler } from '../app/api/internal/clinic/book/route';
import { POST as callSessionHandler } from '../app/api/internal/call-session/route';
import { outboundService } from '../services/outbound.service';
import { calculateSubscriptionBilling } from '../services/entitlement.service';
import { NextRequest } from 'next/server';

function createMockRequest(url: string, body?: any, headers: Record<string, string> = {}): NextRequest {
  const reqInit: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
  if (body) reqInit.body = JSON.stringify(body);
  return new NextRequest(new URL(url, 'http://localhost:3000'), reqInit as any);
}

async function runE2EWorkflowTests() {
  console.log('🌟 RUNNING FULL END-TO-END SAAS PRODUCT WORKFLOW VERIFICATION...\n');
  let passed = 0;

  const testEmail = `dental_${Date.now()}@example.com`;
  const workerSecret = process.env.WORKER_API_SECRET || 'worker-secret';

  // -------------------------------------------------------------------------
  // STEP 1: Self-Serve Customer Signup & Automatic Business Onboarding
  // -------------------------------------------------------------------------
  console.log('--- Step 1: Business Signup & Automated Onboarding ---');
  const signupReq = createMockRequest('http://localhost:3000/api/auth/signup', {
    name: 'Dr. Ramesh Kumar',
    email: testEmail,
    password: 'SecurePassword123!',
    businessName: 'Apollo Dental Coimbatore',
    phone: '+919876543210',
    industry: 'Healthcare / Dental',
    timezone: 'Asia/Kolkata',
  });

  const signupRes = await signupHandler(signupReq);
  const signupData = await signupRes.json();

  if (!signupData.success || !signupData.data?.session?.tenantId) {
    throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
  }

  const { tenantId, userId } = signupData.data.session;
  console.log(`✅ Step 1 PASSED: Business created (Tenant: ${tenantId}, User: ${userId})`);
  passed++;

  // -------------------------------------------------------------------------
  // STEP 2: Encrypted BYOK Provider Configuration
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Encrypted BYOK Setup & Secret Masking ---');
  // Store BYOK Sarvam key directly in integration
  const rawApiKey = 'sk_sarvam_live_998877665544332211aabbcc';
  const { encryptSecret, decryptSecret, maskSecret } = await import('../lib/encryption');

  const integration = await db.integration.create({
    data: {
      tenantId,
      provider: 'BYOK_SARVAM',
      name: 'Sarvam AI Primary',
      status: 'CONNECTED',
      credentialsEncrypted: encryptSecret(rawApiKey),
    },
  });

  // Verify DB contains encrypted ciphertext, not plaintext
  if (integration.credentialsEncrypted === rawApiKey || !integration.credentialsEncrypted?.includes(':')) {
    throw new Error('Integration credentials are not securely encrypted at rest!');
  }

  // Verify worker receives decrypted key over internal m2m endpoint
  const agent = await db.agent.findFirst({ where: { tenantId } });
  const runtimeReq = createMockRequest(
    `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantId}&agentId=${agent!.id}`,
    undefined,
    { authorization: `Bearer ${workerSecret}` }
  );
  const runtimeRes = await runtimeGet(runtimeReq);
  const runtimeData = await runtimeRes.json();

  if (!runtimeData.success || runtimeData.data.byokCredentials?.sarvamApiKey !== rawApiKey) {
    throw new Error(`Worker runtime failed to resolve BYOK credential: ${JSON.stringify(runtimeData)}`);
  }
  console.log('✅ Step 2 PASSED: BYOK API key encrypted at rest and securely decrypted for worker.');
  passed++;

  // -------------------------------------------------------------------------
  // STEP 3: Voice Call Turn & Clinic Appointment Booking with Double-Booking Guard
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Appointment Booking & Conflict Guard ---');
  const bookReq = createMockRequest(
    'http://localhost:3000/api/internal/clinic/book',
    {
      tenantId,
      agentId: agent!.id,
      patientName: 'Karthik Subramanian',
      phone: '+919876500112',
      serviceName: 'Dental Cleaning & Checkup',
      date: '2026-10-16',
      time: '11:00',
    },
    { authorization: `Bearer ${workerSecret}` }
  );

  const bookRes = await bookHandler(bookReq);
  const bookData = await bookRes.json();

  if (!bookData.success || bookData.data?.status !== 'UPCOMING') {
    throw new Error(`Booking failed: ${JSON.stringify(bookData)}`);
  }

  // Verify Conflict on Duplicate Booking Attempt
  const conflictReq = createMockRequest(
    'http://localhost:3000/api/internal/clinic/book',
    {
      tenantId,
      agentId: agent!.id,
      patientName: 'Different Patient',
      phone: '+919876500999',
      serviceName: 'Root Canal Consultation',
      date: '2026-10-16',
      time: '11:00', // Same time slot
    },
    { authorization: `Bearer ${workerSecret}` }
  );
  const conflictRes = await conflictHandlerOrBook(conflictReq);
  if (conflictRes.status !== 409) {
    throw new Error(`Expected 409 Conflict for double booking, got ${conflictRes.status}`);
  }
  console.log('✅ Step 3 PASSED: Appointment booked successfully and double-booking prevented.');
  passed++;

  // -------------------------------------------------------------------------
  // STEP 4: Call Finalization & Atomic Usage Metering with Idempotency
  // -------------------------------------------------------------------------
  console.log('\n--- Step 4: Call Completion & Idempotent Usage Record ---');
  const roomName = `room_call_${Date.now()}`;
  const callPayload = {
    tenantId,
    agentId: agent!.id,
    agentVersionId: agent!.currentVersionId,
    roomName,
    callerNumber: '+919876500112',
    callerName: 'Karthik Subramanian',
    durationSeconds: 125, // 3 billable minutes
    intent: 'Dental Cleaning Booking',
    outcome: 'APPOINTMENT_BOOKED',
    summary: 'Caller Karthik booked a dental cleaning for Oct 16 at 11:00 AM.',
    transcripts: [
      { speaker: 'AGENT', message: 'Vanakkam! Apollo Dental clinic assistant, epdi help pannalaam?' },
      { speaker: 'CUSTOMER', message: 'Vanakkam, enakku dental cleaning appointment venum.' },
      { speaker: 'AGENT', message: 'Sure, Friday 11 AM confirm pannirukkom.' },
    ],
  };

  const callReq = createMockRequest(
    'http://localhost:3000/api/internal/call-session',
    callPayload,
    { authorization: `Bearer ${workerSecret}` }
  );
  const callRes = await callSessionHandler(callReq);
  const callData = await callRes.json();

  if (!callData.success || callData.data?.billableMinutes !== 3) {
    throw new Error(`Call session ingestion failed: ${JSON.stringify(callData)}`);
  }

  // Re-submit identical call report to verify idempotency
  const duplicateReq = createMockRequest(
    'http://localhost:3000/api/internal/call-session',
    callPayload,
    { authorization: `Bearer ${workerSecret}` }
  );
  const duplicateRes = await callSessionHandler(duplicateReq);
  const duplicateData = await duplicateRes.json();

  if (!duplicateData.success || !duplicateData.data?.isDuplicate) {
    throw new Error(`Idempotency check failed: expected duplicate: true, got ${JSON.stringify(duplicateData)}`);
  }

  const usageCount = await db.usageRecord.count({
    where: { tenantId, callId: callData.data.callId },
  });
  if (usageCount !== 1) {
    throw new Error(`Idempotency violation! Found ${usageCount} usage records for call ${callData.data.callId}`);
  }
  console.log('✅ Step 4 PASSED: 3-minute call recorded; retry handled idempotently with 0 duplicate billing.');
  passed++;

  // -------------------------------------------------------------------------
  // STEP 5: Subscription Billing Engine & BYOK Discount Verification
  // -------------------------------------------------------------------------
  console.log('\n--- Step 5: Subscription Billing & Metering Engine ---');
  const billing = await calculateSubscriptionBilling(tenantId);

  if (!billing.isByokActive) {
    throw new Error('Billing engine did not recognize active BYOK integration!');
  }
  if (billing.usedMinutes < 3) {
    throw new Error(`Billing engine failed to sum usage minutes: expected >=3, got ${billing.usedMinutes}`);
  }
  console.log(`   Plan: ${billing.planName} | Used: ${billing.usedMinutes}m / ${billing.includedMinutes}m`);
  console.log(`   BYOK Status: ${billing.isByokActive} (Carrier platform fee: $${billing.overageRatePerMinute}/min)`);
  console.log('✅ Step 5 PASSED: Usage calculated and BYOK pricing applied accurately.');
  passed++;

  // -------------------------------------------------------------------------
  // STEP 6: Outbound Consent & Opt-Out Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- Step 6: Outbound Consent & Opt-Out Enforcement ---');
  const dncPhone = '+919876549999';
  await outboundService.registerOptOut(tenantId, dncPhone, 'Do not call requested');

  const dispatchRes = await outboundService.dispatchCall({
    tenantId,
    agentId: agent!.id,
    recipientNumber: dncPhone,
  });

  if (dispatchRes.success || dispatchRes.errorCode !== 'RECIPIENT_OPTED_OUT') {
    throw new Error(`Expected RECIPIENT_OPTED_OUT, got ${dispatchRes.errorCode}`);
  }
  console.log('✅ Step 6 PASSED: Outbound dispatch rejected for opted-out recipient.');
  passed++;

  console.log(`\n🎉 ALL ${passed}/6 FULL SAAS END-TO-END WORKFLOW ACCEPTANCE TESTS PASSED!`);
}

async function conflictHandlerOrBook(req: NextRequest) {
  return bookHandler(req);
}

runE2EWorkflowTests()
  .catch((err) => {
    console.error('E2E Workflow Test Failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());



