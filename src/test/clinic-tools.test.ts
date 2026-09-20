import { NextRequest } from 'next/server';
import { db } from '../lib/db';
import { POST as checkAvailability } from '../app/api/internal/clinic/availability/route';
import { POST as bookAppointment } from '../app/api/internal/clinic/book/route';

const WORKER_SECRET = process.env.WORKER_API_SECRET || 'dev-worker-secret-do-not-use-in-production-livekit-2026';

function createMockRequest(url: string, body: any, authHeader?: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (authHeader !== undefined) {
    if (authHeader) headers.set('authorization', `Bearer ${authHeader}`);
  } else {
    headers.set('authorization', `Bearer ${WORKER_SECRET}`);
  }

  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function runClinicToolsTests() {
  console.log('🔒 Running Phase 3 Clinic AI Backend Tools Acceptance Tests...\n');

  // Discover Tenant A (Apex Dental Care) and Tenant B (Metro Health)
  const tenantA = await db.tenant.findFirst({
    where: { name: { contains: 'Apex Dental' } },
  });

  const tenantB = await db.tenant.findFirst({
    where: { name: { contains: 'Metro Health' } },
  });

  if (!tenantA || !tenantB) {
    throw new Error('Test clinics not found. Please run seed script first.');
  }

  const agentA = await db.agent.findFirst({
    where: { tenantId: tenantA.id },
  });

  let passed = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ TEST ${totalTests} PASSED: ${msg}`);
      passed++;
    } else {
      console.error(`❌ TEST ${totalTests} FAILED: ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }

  const testDate = '2026-09-22'; // Tuesday (Open)
  const sundayDate = '2026-09-27'; // Sunday (Closed)

  // Clean up any existing appointments for testDate in Tenant A and B to guarantee a clean slate
  await db.appointment.deleteMany({
    where: {
      tenantId: { in: [tenantA.id, tenantB.id] },
      date: testDate,
    },
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Availability Authentication
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Authentication & Authorization ---');
    const reqNoAuth = createMockRequest(
      'http://localhost:3000/api/internal/clinic/availability',
      { tenantId: tenantA.id, date: testDate },
      '' // No auth
    );
    const resNoAuth = await checkAvailability(reqNoAuth);
    assert(resNoAuth.status === 401, 'Availability rejects request with missing auth header');

    const reqBadAuth = createMockRequest(
      'http://localhost:3000/api/internal/clinic/availability',
      { tenantId: tenantA.id, date: testDate },
      'wrong-secret'
    );
    const resBadAuth = await checkAvailability(reqBadAuth);
    assert(resBadAuth.status === 401, 'Availability rejects request with invalid auth token');

    // -------------------------------------------------------------
    // Test 2: Availability Input Validation & Business Hours
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: Availability Queries & Schedule ---');
    const reqBadDate = createMockRequest(
      'http://localhost:3000/api/internal/clinic/availability',
      { tenantId: tenantA.id, date: 'not-a-date' }
    );
    const resBadDate = await checkAvailability(reqBadDate);
    assert(resBadDate.status === 400, 'Availability rejects malformed date string');

    // Tuesday (Clinic open)
    const reqOpen = createMockRequest(
      'http://localhost:3000/api/internal/clinic/availability',
      { tenantId: tenantA.id, date: testDate }
    );
    const resOpen = await checkAvailability(reqOpen);
    const dataOpen = await resOpen.json();
    assert(
      resOpen.status === 200 &&
      dataOpen.success &&
      dataOpen.data.isOpen === true &&
      Array.isArray(dataOpen.data.availableSlots) &&
      dataOpen.data.availableSlots.length > 0 &&
      dataOpen.data.availableSlots.includes('10:00'),
      'Availability returns open slots for weekday operating hours'
    );

    // Sunday (Clinic closed)
    const reqSunday = createMockRequest(
      'http://localhost:3000/api/internal/clinic/availability',
      { tenantId: tenantA.id, date: sundayDate }
    );
    const resSunday = await checkAvailability(reqSunday);
    const dataSunday = await resSunday.json();
    assert(
      resSunday.status === 200 &&
      dataSunday.success &&
      dataSunday.data.isOpen === false &&
      dataSunday.data.availableSlots.length === 0,
      'Availability reports clinic closed on Sunday with 0 available slots'
    );

    // -------------------------------------------------------------
    // Test 3: Appointment Booking Validation & Business Rules
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Appointment Booking & Validation ---');
    const reqShortPhone = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Jane Doe',
        phone: '123',
        date: testDate,
        time: '10:00',
        serviceName: 'Cleaning',
      }
    );
    const resShortPhone = await bookAppointment(reqShortPhone);
    assert(resShortPhone.status === 400, 'Booking rejects phone number with fewer than 7 digits');

    // Attempt booking on closed day
    const reqBookSunday = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Jane Doe',
        phone: '+1 (555) 444-2200',
        date: sundayDate,
        time: '10:00',
        serviceName: 'Cleaning',
      }
    );
    const resBookSunday = await bookAppointment(reqBookSunday);
    assert(resBookSunday.status === 400, 'Booking rejects appointment on closed day (Sunday)');

    // Attempt booking outside business hours (22:00)
    const reqBookNight = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Jane Doe',
        phone: '+1 (555) 444-2200',
        date: testDate,
        time: '22:00',
        serviceName: 'Cleaning',
      }
    );
    const resBookNight = await bookAppointment(reqBookNight);
    assert(resBookNight.status === 400, 'Booking rejects time outside clinic operating hours');

    // -------------------------------------------------------------
    // Test 4: Successful Appointment Booking & Persistence
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Successful Transactional Booking ---');
    const targetSlot = '11:00';
    const reqBookValid = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        agentId: agentA?.id,
        patientName: 'Alice Springs',
        phone: '+1 (555) 444-8899',
        date: testDate,
        time: targetSlot,
        serviceName: 'Dental Cleaning & Checkup',
        notes: 'Routine visit, prefers morning',
      }
    );
    const resBookValid = await bookAppointment(reqBookValid);
    const dataBookValid = await resBookValid.json();
    assert(
      resBookValid.status === 200 &&
      dataBookValid.success &&
      dataBookValid.data.status === 'UPCOMING' &&
      dataBookValid.data.date === testDate &&
      dataBookValid.data.time === targetSlot &&
      dataBookValid.data.isExisting === false,
      'Valid appointment successfully booked and returned UPCOMING status'
    );

    // Verify appointment exists in DB and slot is now removed from availability
    const aptInDb = await db.appointment.findUnique({
      where: { id: dataBookValid.data.appointmentId },
      include: { customer: true },
    });
    assert(
      aptInDb !== null &&
      aptInDb.tenantId === tenantA.id &&
      aptInDb.customer?.name === 'Alice Springs',
      'Appointment and Customer records transactionally persisted in database'
    );

    const resCheckAfter = await checkAvailability(
      createMockRequest('http://localhost:3000/api/internal/clinic/availability', {
        tenantId: tenantA.id,
        date: testDate,
      })
    );
    const dataCheckAfter = await resCheckAfter.json();
    assert(
      !dataCheckAfter.data.availableSlots.includes(targetSlot),
      `Booked slot ${targetSlot} is no longer returned in available slots`
    );

    // -------------------------------------------------------------
    // Test 5: Double-Booking Prevention & Idempotency
    // -------------------------------------------------------------
    console.log('\n--- Test Group 5: Double Booking Prevention & Idempotency ---');
    // Different patient attempting to book the SAME slot
    const reqDoubleBook = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Bob Williams',
        phone: '+1 (555) 999-7711',
        date: testDate,
        time: targetSlot, // already booked by Alice
        serviceName: 'Consultation',
      }
    );
    const resDoubleBook = await bookAppointment(reqDoubleBook);
    assert(
      resDoubleBook.status === 409,
      'Double-booking rejected with 409 Conflict when another patient attempts to book the same slot'
    );

    // Idempotent retry: Alice Springs requests the same booking again
    const reqIdempotent = createMockRequest(
      'http://localhost:3000/api/internal/clinic/book',
      {
        tenantId: tenantA.id,
        patientName: 'Alice Springs',
        phone: '+1 (555) 444-8899',
        date: testDate,
        time: targetSlot,
        serviceName: 'Dental Cleaning & Checkup',
      }
    );
    const resIdempotent = await bookAppointment(reqIdempotent);
    const dataIdempotent = await resIdempotent.json();
    assert(
      resIdempotent.status === 200 &&
      dataIdempotent.success &&
      dataIdempotent.data.isExisting === true &&
      dataIdempotent.data.appointmentId === dataBookValid.data.appointmentId,
      'Idempotent retry returns existing appointment confirmation without duplicating records'
    );

    // -------------------------------------------------------------
    // Test 6: Cross-Tenant Booking Isolation
    // -------------------------------------------------------------
    console.log('\n--- Test Group 6: Multi-Tenant Isolation ---');
    // Tenant B queries same date - slot 11:00 should STILL be available for Tenant B because clinics are completely isolated!
    const resTenantBAvail = await checkAvailability(
      createMockRequest('http://localhost:3000/api/internal/clinic/availability', {
        tenantId: tenantB.id,
        date: testDate,
      })
    );
    const dataTenantBAvail = await resTenantBAvail.json();
    assert(
      dataTenantBAvail.data.availableSlots.includes(targetSlot),
      'Tenant B availability is completely isolated from Tenant A appointments'
    );

    console.log(`\n🎉 All ${passed}/${totalTests} Clinic AI Backend Tools Acceptance Tests PASSED!`);
  } finally {
    // Cleanup test appointments created during this test run
    await db.appointment.deleteMany({
      where: {
        tenantId: { in: [tenantA.id, tenantB.id] },
        date: testDate,
      },
    });
    await db.$disconnect();
  }
}

runClinicToolsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
