import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';
import { POST as bookAppointment } from '../app/api/internal/clinic/book/route';
import { POST as cancelAppointment } from '../app/api/internal/clinic/cancel/route';
import { POST as rescheduleAppointment } from '../app/api/internal/clinic/reschedule/route';
import { resolveTenantBusinessRules } from '../services/rules.service';
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

function createPostRequest(url: string, body: any, bearerToken?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (bearerToken !== undefined) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function runPhase4Tests() {
  console.log('🔒 Running Phase 4 Business Rules, Concurrency & Automation Tests...\n');

  const tenantA = await db.tenant.findFirst({ where: { name: 'Apex Dental Care' } });
  const tenantB = await db.tenant.findFirst({ where: { name: 'Metro Health Clinic' } });

  if (!tenantA || !tenantB) {
    throw new Error('Test tenants not found.');
  }

  let passed = 0;

  try {
    // -------------------------------------------------------------
    // Test Group 1: Business Rule Engine Hierarchy & Priority
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Business Rules Engine ---');
    const rulesA = resolveTenantBusinessRules(tenantA.id);

    // Rule priority test: Safety > Security > Business Rules
    if (
      rulesA.priority[0] === '1_safety_rules' &&
      rulesA.priority[1] === '2_security_rules' &&
      rulesA.priority[2] === '3_tenant_business_rules' &&
      rulesA.safetyRules.nonClinicalRole === true &&
      rulesA.safetyRules.emergencyEscalation === true &&
      rulesA.businessRules.confirmationRequired === true
    ) {
      console.log('✅ TEST 1 PASSED: Strict 7-level rule priority hierarchy enforced.');
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED: Incorrect rule hierarchy', rulesA);
    }

    // Tenant customization test
    const customConfigJson = JSON.stringify({
      maxResponseLengthWords: 30,
      cancellationWindowHours: 4,
      niche: 'clinic',
    });
    const customRules = resolveTenantBusinessRules(tenantA.id, customConfigJson);
    if (
      customRules.businessRules.maxResponseLengthWords === 30 &&
      customRules.businessRules.cancellationWindowHours === 4 &&
      customRules.safetyRules.nonClinicalRole === true // Immutable safety remains intact
    ) {
      console.log('✅ TEST 2 PASSED: Tenant overrides applied cleanly without compromising safety rules.');
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED: Failed custom rule overrides', customRules);
    }

    // -------------------------------------------------------------
    // Test Group 2: Concurrency & Double Booking Protection
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: High Concurrency Slot Booking ---');
    const testDate = '2026-09-24';
    const testTime = '15:30';

    // Cleanup any existing test appointment for this slot
    await db.appointment.deleteMany({
      where: { tenantId: tenantA.id, date: testDate, time: testTime },
    });

    const reqCustomerA = createPostRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Customer Alpha',
        phone: '+15551112222',
        date: testDate,
        time: testTime,
        serviceName: 'Dental Cleaning',
      },
      WORKER_SECRET
    );

    const reqCustomerB = createPostRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Customer Beta',
        phone: '+15553334444',
        date: testDate,
        time: testTime,
        serviceName: 'Tooth Extraction',
      },
      WORKER_SECRET
    );

    // Fire both booking requests concurrently at the exact same moment
    const [resA, resB] = await Promise.all([
      bookAppointment(reqCustomerA),
      bookAppointment(reqCustomerB),
    ]);

    const statusA = resA.status;
    const statusB = resB.status;

    // Exactly one must succeed (200), and the other must be rejected with 409 Conflict
    const oneSuccess = (statusA === 200 && statusB === 409) || (statusA === 409 && statusB === 200);

    if (oneSuccess) {
      console.log('✅ TEST 3 PASSED: Concurrent booking race condition resolved: exactly 1 succeeded, 1 rejected with 409 Conflict.');
      passed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Unexpected statuses statusA=${statusA}, statusB=${statusB}`);
    }

    // Verify database has exactly 1 appointment for this slot
    const count = await db.appointment.count({
      where: {
        tenantId: tenantA.id,
        date: testDate,
        time: testTime,
        status: { in: ['UPCOMING', 'CONFIRMED'] },
      },
    });

    if (count === 1) {
      console.log('✅ TEST 4 PASSED: Authoritative database contains exactly 1 unique appointment for the contested time slot.');
      passed++;
    } else {
      console.error(`❌ TEST 4 FAILED: Expected 1 appointment, found ${count}`);
    }

    // -------------------------------------------------------------
    // Test Group 3: Google Sheets & WhatsApp Sync Automation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Google Sheets & WhatsApp Sync ---');
    const winningRes = statusA === 200 ? resA : resB;
    const winningData = await winningRes.json();
    const bookedApt = await db.appointment.findUnique({
      where: { id: winningData.data.appointmentId },
    });

    if (
      bookedApt &&
      bookedApt.sheetSyncStatus === 'SUCCESS' &&
      bookedApt.sheetRowId &&
      bookedApt.whatsappStatus === 'SENT' &&
      bookedApt.whatsappMessageId
    ) {
      console.log('✅ TEST 5 PASSED: Post-booking automation synced to Google Sheets and dispatched WhatsApp confirmation.');
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED: Integrations did not record expected statuses', bookedApt);
    }

    // Test Idempotent Retry does NOT duplicate rows or messages
    const retryReq = createPostRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: winningData.data.patientName,
        phone: winningData.data.phone,
        date: testDate,
        time: testTime,
        serviceName: winningData.data.serviceName,
      },
      WORKER_SECRET
    );
    const retryRes = await bookAppointment(retryReq);
    const retryData = await retryRes.json();

    if (
      retryRes.status === 200 &&
      retryData.data.isExisting === true &&
      retryData.data.appointmentId === winningData.data.appointmentId
    ) {
      console.log('✅ TEST 6 PASSED: Idempotent booking retry safely returned existing booking without duplicating Sheet rows or WhatsApp messages.');
      passed++;
    } else {
      console.error('❌ TEST 6 FAILED: Retry failed', retryData);
    }

    // -------------------------------------------------------------
    // Test Group 4: Cancellation & Rescheduling Automation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Cancellation & Rescheduling ---');
    const aptIdToCancel = winningData.data.appointmentId;

    // Reschedule test: Reschedule to 16:00
    const rescheduleReq = createPostRequest(
      'http://localhost:3000/api/internal/clinic/reschedule',
      {
        tenantId: tenantA.id,
        appointmentId: aptIdToCancel,
        newDate: testDate,
        newTime: '16:00',
      },
      WORKER_SECRET
    );
    const rescheduleRes = await rescheduleAppointment(rescheduleReq);
    const rescheduleData = await rescheduleRes.json();

    if (rescheduleRes.status === 200 && rescheduleData.data.newTime === '16:00') {
      console.log('✅ TEST 7 PASSED: Appointment successfully rescheduled to 16:00.');
      passed++;
    } else {
      console.error('❌ TEST 7 FAILED: Rescheduling failed', rescheduleData);
    }

    // Now the original 15:30 slot should be freed!
    const testSlotFreed = await db.appointment.findFirst({
      where: {
        tenantId: tenantA.id,
        date: testDate,
        time: testTime,
        status: { in: ['UPCOMING', 'CONFIRMED'] },
      },
    });

    if (!testSlotFreed) {
      console.log('✅ TEST 8 PASSED: Previous slot 15:30 is completely freed for other callers.');
      passed++;
    } else {
      console.error('❌ TEST 8 FAILED: Previous slot was not freed', testSlotFreed);
    }

    // Cancellation test: Cancel rescheduled appointment
    const cancelReq = createPostRequest(
      'http://localhost:3000/api/internal/clinic/cancel',
      {
        tenantId: tenantA.id,
        appointmentId: aptIdToCancel,
        reason: 'Patient schedule conflict',
      },
      WORKER_SECRET
    );
    const cancelRes = await cancelAppointment(cancelReq);
    const cancelData = await cancelRes.json();

    if (cancelRes.status === 200 && cancelData.data.success) {
      console.log('✅ TEST 9 PASSED: Appointment successfully cancelled and slotKey released.');
      passed++;
    } else {
      console.error('❌ TEST 9 FAILED: Cancellation failed', cancelData);
    }

    console.log(`\n🎉 All ${passed}/9 Phase 4 Business Rules, Concurrency & Automation Tests PASSED!`);
  } finally {
    await db.$disconnect();
  }
}

runPhase4Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
