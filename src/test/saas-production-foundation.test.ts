import { db } from '../lib/db';
import { encryptSecret, decryptSecret, maskSecret, isMaskedValue } from '../lib/encryption';
import { outboundService } from '../services/outbound.service';
import { concurrencyService } from '../services/concurrency.service';
import { calculateSubscriptionBilling, enforceRecordingRetention } from '../services/entitlement.service';
import { POST as stripeWebhookHandler } from '../app/api/webhooks/stripe/route';
import { POST as signupHandler } from '../app/api/auth/signup/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function createMockRequest(url: string, body?: any, headers: Record<string, string> = {}): NextRequest {
  const reqInit: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
  if (body) reqInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new NextRequest(new URL(url, 'http://localhost:3000'), reqInit as any);
}

function generateStripeSignature(rawBody: string, secret: string, timestamp?: number): string {
  const t = timestamp || Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${signature}`;
}

async function runSaaSFoundationTests() {
  console.log('🚀 Running Z Cloud SaaS Production Foundation & Security Acceptance Tests...\n');
  let passed = 0;

  // -------------------------------------------------------------
  // TEST 1: Encryption & Masking
  // -------------------------------------------------------------
  console.log('--- Test 1: AES-256-GCM Encryption & Key Masking ---');
  const sampleKey = 'sk_live_sarvam_998877665544332211aabbcc';
  const encrypted = encryptSecret(sampleKey);

  if (!encrypted.includes(':') || encrypted === sampleKey) {
    throw new Error('Encryption failed to produce expected format');
  }
  const decrypted = decryptSecret(encrypted);
  if (decrypted !== sampleKey) {
    throw new Error(`Decryption mismatch! Expected ${sampleKey}, got ${decrypted}`);
  }
  const masked = maskSecret(sampleKey, 4);
  if (!masked.endsWith('bbcc') || !isMaskedValue(masked)) {
    throw new Error(`Masking failed! Got ${masked}`);
  }
  console.log('✅ TEST 1 PASSED: AES-256-GCM encrypt/decrypt & masking verified.');
  passed++;

  // -------------------------------------------------------------
  // TEST 2: Outbound DNC & Opt-Out Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Outbound Consent & Opt-Out Enforcement ---');
  const testTenant = await db.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!testTenant) throw new Error('No active tenant found for test');

  const testPhone = '+15559998888';
  await outboundService.registerOptOut(testTenant.id, testPhone, 'Patient requested stop');
  const isOptedOut = await outboundService.checkOptOut(testTenant.id, testPhone);
  if (!isOptedOut) {
    throw new Error('Opt-out check returned false after registration');
  }

  // Attempt dispatch to opted-out recipient
  const dispatchRes = await outboundService.dispatchCall({
    tenantId: testTenant.id,
    agentId: 'dummy-agent',
    recipientNumber: testPhone,
  });

  if (dispatchRes.success || dispatchRes.errorCode !== 'RECIPIENT_OPTED_OUT') {
    throw new Error(`Expected RECIPIENT_OPTED_OUT, got ${dispatchRes.errorCode}`);
  }
  console.log('✅ TEST 2 PASSED: Outbound dispatch blocked for opted-out recipient.');
  passed++;

  // -------------------------------------------------------------
  // TEST 3: Outbound Telephony Credential & Dispatch Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 3: Outbound Provider Credential Validation ---');
  const nonOptedPhone = '+15558887777';

  // Temporarily unset LIVEKIT_URL to test error return when credentials absent
  const originalUrl = process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_URL;

  const noCredsRes = await outboundService.dispatchCall({
    tenantId: testTenant.id,
    agentId: 'dummy-agent',
    recipientNumber: nonOptedPhone,
  });

  process.env.LIVEKIT_URL = originalUrl;

  if (noCredsRes.success || noCredsRes.errorCode !== 'CONFIGURATION_ERROR') {
    throw new Error(`Expected CONFIGURATION_ERROR when credentials missing, got ${JSON.stringify(noCredsRes)}`);
  }

  // Now test dispatch with credentials present
  const validDispatchRes = await outboundService.dispatchCall({
    tenantId: testTenant.id,
    agentId: 'dummy-agent',
    recipientNumber: nonOptedPhone,
  });

  if (!validDispatchRes.success || !validDispatchRes.callId || !validDispatchRes.roomName) {
    throw new Error(`Valid dispatch failed: ${JSON.stringify(validDispatchRes)}`);
  }

  // Release the slot from the successful dispatch
  await concurrencyService.releaseSlot(validDispatchRes.callId, 'COMPLETED');
  console.log('✅ TEST 3 PASSED: Outbound returns clear CONFIGURATION_ERROR on missing credentials & dispatches with credentials.');
  passed++;

  // -------------------------------------------------------------
  // TEST 4: Database-Backed Atomic Concurrency Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Database-Backed Atomic Concurrency Enforcement Under Simultaneous Requests ---');

  // Create isolated single-concurrency tenant
  const singleSlotTenant = await db.tenant.create({
    data: {
      name: 'Single Slot Practice',
      timezone: 'Asia/Kolkata',
      country: 'IN',
      status: 'ACTIVE',
    },
  });

  const singlePlan = await db.plan.create({
    data: {
      code: `SINGLE_SLOT_${Date.now()}`,
      name: 'Single Slot Plan',
      priceMonthly: 50,
      monthlyMinutes: 200,
      maxAgents: 1,
      maxUsers: 1,
      maxPhoneNumbers: 1,
      maxConcurrentCalls: 1, // Strict limit = 1
    },
  });

  await db.tenantSubscription.create({
    data: {
      tenantId: singleSlotTenant.id,
      planId: singlePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  // Launch 5 simultaneous requests attempting to acquire slot concurrently
  const simultaneousResults = await Promise.all([
    concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_1'),
    concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_2'),
    concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_3'),
    concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_4'),
    concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_5'),
  ]);

  const acquiredCount = simultaneousResults.filter((r) => r.acquired).length;
  const rejectedCount = simultaneousResults.filter((r) => !r.acquired).length;

  if (acquiredCount !== 1) {
    throw new Error(`Atomic concurrency violation! Expected exactly 1 acquired slot, got ${acquiredCount}. Results: ${JSON.stringify(simultaneousResults)}`);
  }

  if (rejectedCount !== 4) {
    throw new Error(`Expected exactly 4 rejected requests under concurrency limit, got ${rejectedCount}`);
  }

  // Release the acquired slot
  const acquiredSlot = simultaneousResults.find((r) => r.acquired);
  const winningCallId = acquiredSlot!.slotId!.split('_')[3]; // Extract call id
  await concurrencyService.releaseSlot(winningCallId, 'COMPLETED');

  // Verify that slot can now be acquired again
  const reacquireRes = await concurrencyService.acquireSlot(singleSlotTenant.id, 'call_race_subsequent');
  if (!reacquireRes.acquired) {
    throw new Error('Failed to acquire slot after releasing previous slot!');
  }
  await concurrencyService.releaseSlot('call_race_subsequent', 'COMPLETED');

  console.log(`✅ TEST 4 PASSED: Atomic database locking strictly serialized 5 simultaneous requests (1 won, 4 rejected).`);
  passed++;

  // -------------------------------------------------------------
  // TEST 5: Stripe Webhook Signature, Replay Guard & Lifecycle
  // -------------------------------------------------------------
  console.log('\n--- Test 5: Stripe Webhook Signature, Replay Guard & Lifecycle ---');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret_for_isolated_test_suite_12345';
  const eventId = `evt_${Date.now()}`;
  const checkoutPayload = JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${Date.now()}`,
        client_reference_id: testTenant.id,
        customer: 'cus_stripe_test_123',
        subscription: 'sub_stripe_test_123',
        payment_status: 'paid',
        metadata: {
          tenantId: testTenant.id,
          planCode: 'STARTER',
        },
      },
    },
  });

  // 5a. Unverified request (missing signature header)
  const unverifiedReq = createMockRequest('http://localhost:3000/api/webhooks/stripe', checkoutPayload);
  const unverifiedRes = await stripeWebhookHandler(unverifiedReq);
  if (unverifiedRes.status !== 401) {
    throw new Error(`Expected 401 for unverified request, got ${unverifiedRes.status}`);
  }

  // 5b. Bad signature with valid timestamp window
  const nowForBadSig = Math.floor(Date.now() / 1000);
  const badSigReq = createMockRequest('http://localhost:3000/api/webhooks/stripe', checkoutPayload, {
    'stripe-signature': `t=${nowForBadSig},v1=invalidsignaturehex1234567890abcdef1234567890abcdef1234567890abcdef`,
  });
  const badSigRes = await stripeWebhookHandler(badSigReq);
  if (badSigRes.status !== 401) {
    throw new Error(`Expected 401 for bad signature, got ${badSigRes.status}`);
  }

  // 5c. Replay attack with expired timestamp (600 seconds ago)
  const expiredTimestamp = Math.floor(Date.now() / 1000) - 600;
  const expiredSig = generateStripeSignature(checkoutPayload, webhookSecret, expiredTimestamp);
  const expiredReq = createMockRequest('http://localhost:3000/api/webhooks/stripe', checkoutPayload, {
    'stripe-signature': expiredSig,
  });
  const expiredRes = await stripeWebhookHandler(expiredReq);
  if (expiredRes.status !== 400) {
    throw new Error(`Expected 400 for expired signature timestamp, got ${expiredRes.status}`);
  }

  // 5d. Valid signed webhook request
  const validSig = generateStripeSignature(checkoutPayload, webhookSecret);
  const validReq = createMockRequest('http://localhost:3000/api/webhooks/stripe', checkoutPayload, {
    'stripe-signature': validSig,
  });
  const validRes = await stripeWebhookHandler(validReq);
  const validData = await validRes.json();
  if (!validData.received || validData.duplicate) {
    throw new Error(`Valid webhook failed: ${JSON.stringify(validData)}`);
  }

  // 5e. Duplicate event delivery of the exact same event ID
  const dupReq = createMockRequest('http://localhost:3000/api/webhooks/stripe', checkoutPayload, {
    'stripe-signature': validSig,
  });
  const dupRes = await stripeWebhookHandler(dupReq);
  const dupData = await dupRes.json();
  if (!dupData.received || !dupData.duplicate) {
    throw new Error(`Expected duplicate: true for replayed event, got ${JSON.stringify(dupData)}`);
  }

  console.log('✅ TEST 5 PASSED: Stripe signature validation, replay window guard, and duplicate idempotency verified.');
  passed++;

  // -------------------------------------------------------------
  // TEST 6: India-Friendly Signup Defaults
  // -------------------------------------------------------------
  console.log('\n--- Test 6: India-Friendly Signup Defaults ---');
  const indiaSignupReq = createMockRequest('http://localhost:3000/api/auth/signup', {
    name: 'Dr. Ananya Sharma',
    email: `ananya_${Date.now()}@clinicindia.example.com`,
    password: 'SecureClinicPassword123!',
    businessName: 'Ananya Dental Care',
  });

  const indiaSignupRes = await signupHandler(indiaSignupReq);
  const indiaSignupData = await indiaSignupRes.json();
  if (!indiaSignupData.success || !indiaSignupData.data?.session?.tenantId) {
    throw new Error(`India signup failed: ${JSON.stringify(indiaSignupData)}`);
  }

  const createdTenant = await db.tenant.findUnique({
    where: { id: indiaSignupData.data.session.tenantId },
    include: {
      settings: true,
      agents: {
        include: { versions: { take: 1 } },
      },
    },
  });

  if (createdTenant?.timezone !== 'Asia/Kolkata') {
    throw new Error(`Expected default timezone 'Asia/Kolkata', got '${createdTenant?.timezone}'`);
  }
  if (createdTenant?.country !== 'IN') {
    throw new Error(`Expected default country 'IN', got '${createdTenant?.country}'`);
  }

  // Check Monday-Saturday business hours created in database
  const hours = await db.businessHours.findMany({
    where: { tenantId: createdTenant.id },
  });
  const saturdayHours = hours.find((h) => h.dayOfWeek === 'saturday');
  if (!saturdayHours || saturdayHours.closed) {
    throw new Error('Expected Saturday business hours to be open for India clinic standard.');
  }

  const defaultAgentVersion = createdTenant.agents[0]?.versions[0];
  if (defaultAgentVersion?.voiceLanguage !== 'en-IN') {
    throw new Error(`Expected default voiceLanguage 'en-IN', got '${defaultAgentVersion?.voiceLanguage}'`);
  }

  console.log('✅ TEST 6 PASSED: Signup defaults confirmed (Asia/Kolkata, IN, en-IN voice, Mon-Sat clinic hours).');
  passed++;

  // -------------------------------------------------------------
  // TEST 7: Subscription Overage Billing Engine
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Subscription & Overage Billing Engine ---');
  const billing = await calculateSubscriptionBilling(testTenant.id);

  if (typeof billing.basePriceMonthly !== 'number' || typeof billing.totalEstimatedAmount !== 'number') {
    throw new Error('Billing computation returned invalid structure');
  }

  console.log(`   Plan: ${billing.planName} ($${billing.basePriceMonthly}/mo)`);
  console.log(`   Included: ${billing.includedMinutes}m | Used: ${billing.usedMinutes}m | Overage: ${billing.overageMinutes}m`);
  console.log(`   Overage rate: $${billing.overageRatePerMinute}/min (BYOK: ${billing.isByokActive})`);
  console.log(`   Estimated total: $${billing.totalEstimatedAmount}`);
  console.log('✅ TEST 7 PASSED: Subscription overage engine computed successfully.');
  passed++;

  // -------------------------------------------------------------
  // TEST 8: Configurable Recording Retention & Physical Audio Cleanup
  // -------------------------------------------------------------
  console.log('\n--- Test 8: Recording Retention & Physical Audio File Deletion ---');
  const tempAudioDir = path.resolve(process.cwd(), 'scratch_recordings');
  if (!fs.existsSync(tempAudioDir)) {
    fs.mkdirSync(tempAudioDir, { recursive: true });
  }
  const testAudioFile = path.join(tempAudioDir, `expired_call_${Date.now()}.wav`);
  fs.writeFileSync(testAudioFile, Buffer.from('RIFF_MOCK_AUDIO_DATA'));

  if (!fs.existsSync(testAudioFile)) {
    throw new Error('Failed to create mock audio file for retention test');
  }

  // Create an expired call record (120 days ago) with this audio file URL
  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 120);

  const expiredCall = await db.call.create({
    data: {
      tenantId: testTenant.id,
      callerNumber: '+15551113333',
      direction: 'INBOUND',
      status: 'COMPLETED',
      startedAt: expiredDate,
      recordingUrl: testAudioFile,
    },
  });

  const retentionRes = await enforceRecordingRetention(testTenant.id);

  // Verify the physical file on disk was unlinked
  const fileStillExists = fs.existsSync(testAudioFile);
  if (fileStillExists) {
    throw new Error('Physical audio file was NOT deleted by retention enforcement!');
  }

  // Verify the database record has null recordingUrl
  const updatedCall = await db.call.findUnique({ where: { id: expiredCall.id } });
  if (updatedCall?.recordingUrl !== null) {
    throw new Error(`Expected recordingUrl in database to be null, got '${updatedCall?.recordingUrl}'`);
  }

  // Clean up directory
  try {
    fs.rmdirSync(tempAudioDir);
  } catch {}

  console.log(`✅ TEST 8 PASSED: Expired recording cleaned from DB and physical file deleted from disk (deletedStorageFilesCount: ${retentionRes.deletedStorageFilesCount}).`);
  passed++;

  console.log(`\n🎉 All ${passed}/8 SaaS Production Foundation & Security Acceptance Tests PASSED!`);
}

runSaaSFoundationTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
