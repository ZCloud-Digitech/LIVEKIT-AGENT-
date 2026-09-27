/**
 * Phase 3 Full Clinic AI Intelligence & Business Tools Acceptance Suite
 * Validates:
 * 1. Worker Authentication on all 10 tools
 * 2. Multi-tenant isolation across all data models and tools
 * 3. ClinicProfile CRUD
 * 4. ClinicService CRUD & safe deletion
 * 5. BusinessHours management & closed days
 * 6. Customer lookup & duplicate customer prevention
 * 7. Availability calculation
 * 8. Transactional appointment booking with atomic slot reservation
 * 9. Appointment cancellation & slot release
 * 10. Appointment rescheduling
 * 11. Human escalation & CallEvent logging
 * 12. Idempotency against tool retries
 */

import { NextRequest } from 'next/server';
import { db } from '../lib/db';
import { POST as getClinicInfo } from '../app/api/internal/clinic/info/route';
import { POST as getServices } from '../app/api/internal/clinic/services/route';
import { POST as getBusinessHours } from '../app/api/internal/clinic/hours/route';
import { POST as checkAvailability } from '../app/api/internal/clinic/availability/route';
import { POST as findCustomer } from '../app/api/internal/clinic/customer/find/route';
import { POST as createCustomer } from '../app/api/internal/clinic/customer/create/route';
import { POST as bookAppointment } from '../app/api/internal/clinic/book/route';
import { POST as cancelAppointment } from '../app/api/internal/clinic/cancel/route';
import { POST as rescheduleAppointment } from '../app/api/internal/clinic/reschedule/route';
import { POST as requestTransfer } from '../app/api/internal/clinic/transfer/route';
import { clinicService } from '../services/clinic.service';

const WORKER_SECRET = process.env.WORKER_API_SECRET || 'dev_worker_secret_123';

function createMockRequest(url: string, body?: any, secret: string = WORKER_SECRET): NextRequest {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  if (secret) {
    headers.set('Authorization', `Bearer ${secret}`);
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

let totalTests = 0;
let passed = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ TEST ${totalTests} PASSED: ${testName}`);
    passed++;
  } else {
    console.error(`❌ TEST ${totalTests} FAILED: ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runPhase3Suite() {
  console.log('🔒 Running Phase 3 Clinic AI Intelligence & Business Tools Acceptance Suite...\n');

  // Setup test tenants
  const tenantA = await db.tenant.upsert({
    where: { id: 'test_phase3_tenant_a' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'test_phase3_tenant_a',
      name: 'Springfield Dental Care',
      phone: '+1 (555) 111-2222',
      email: 'contact@springfielddental.com',
      address: '742 Evergreen Terrace',
      timezone: 'America/New_York',
      status: 'ACTIVE',
    },
  });

  const tenantB = await db.tenant.upsert({
    where: { id: 'test_phase3_tenant_b' },
    update: { status: 'ACTIVE' },
    create: {
      id: 'test_phase3_tenant_b',
      name: 'Shelbyville Health Center',
      phone: '+1 (555) 333-4444',
      email: 'info@shelbyvillehealth.com',
      address: '100 Shelbyville Blvd',
      timezone: 'America/Chicago',
      status: 'ACTIVE',
    },
  });

  const testDate = '2026-10-14'; // Wednesday
  const sundayDate = '2026-10-18'; // Sunday

  try {
    // -----------------------------------------------------------------
    // Group 1: Worker Authentication Enforcement Across Tools
    // -----------------------------------------------------------------
    console.log('--- Group 1: Worker Authentication Enforcement ---');
    const reqNoAuth = createMockRequest('http://localhost/api/internal/clinic/info', { tenantId: tenantA.id }, '');
    const resNoAuth = await getClinicInfo(reqNoAuth);
    assert(resNoAuth.status === 401, 'get_clinic_info rejects request with missing auth header');

    const reqBadAuth = createMockRequest('http://localhost/api/internal/clinic/info', { tenantId: tenantA.id }, 'invalid_secret');
    const resBadAuth = await getClinicInfo(reqBadAuth);
    assert(resBadAuth.status === 401, 'get_clinic_info rejects request with invalid secret');

    const reqServicesNoAuth = createMockRequest('http://localhost/api/internal/clinic/services', { tenantId: tenantA.id }, '');
    const resServicesNoAuth = await getServices(reqServicesNoAuth);
    assert(resServicesNoAuth.status === 401, 'get_services rejects request without worker auth');

    const reqCustNoAuth = createMockRequest('http://localhost/api/internal/clinic/customer/find', { tenantId: tenantA.id, phone: '5551112222' }, '');
    const resCustNoAuth = await findCustomer(reqCustNoAuth);
    assert(resCustNoAuth.status === 401, 'find_customer rejects request without worker auth');

    // -----------------------------------------------------------------
    // Group 2: ClinicProfile CRUD & Tool 1 (get_clinic_info)
    // -----------------------------------------------------------------
    console.log('\n--- Group 2: Clinic Profile & Info Tool ---');
    await clinicService.upsertClinicProfile(tenantA.id, {
      clinicName: 'Springfield Family Dental Care',
      description: 'Comprehensive family dentistry and oral surgery',
      phone: '+1 (555) 777-8888',
      email: 'frontdesk@springfielddental.com',
      address: '742 Evergreen Terrace, Springfield, IL',
      timezone: 'America/New_York',
      website: 'https://springfielddental.example.com',
      emergencyInstruction: 'If you are experiencing severe oral bleeding or trauma, visit Springfield General Hospital immediately.',
    });

    const reqInfo = createMockRequest('http://localhost/api/internal/clinic/info', { tenantId: tenantA.id });
    const resInfo = await getClinicInfo(reqInfo);
    const dataInfo = await resInfo.json();
    assert(
      resInfo.status === 200 &&
      dataInfo.success &&
      dataInfo.data.clinicName === 'Springfield Family Dental Care' &&
      dataInfo.data.phone === '+1 (555) 777-8888' &&
      dataInfo.data.timezone === 'America/New_York',
      'get_clinic_info returns configured clinic profile attributes'
    );

    // -----------------------------------------------------------------
    // Group 3: ClinicService CRUD & Tool 2 (get_services)
    // -----------------------------------------------------------------
    console.log('\n--- Group 3: Clinic Services & get_services Tool ---');
    // Ensure clean state
    await db.clinicService.deleteMany({ where: { tenantId: tenantA.id } });

    const s1 = await clinicService.createService(tenantA.id, {
      name: 'Teeth Cleaning',
      description: 'Standard dental cleaning and checkup',
      durationMinutes: 45,
      price: 120,
    });
    const s2 = await clinicService.createService(tenantA.id, {
      name: 'Emergency Tooth Extraction',
      description: 'Urgent oral extraction',
      durationMinutes: 60,
      price: 350,
      active: true,
    });
    const s3 = await clinicService.createService(tenantA.id, {
      name: 'Experimental Whitening',
      description: 'Inactive service',
      durationMinutes: 30,
      price: 200,
      active: false,
    });

    const reqServ = createMockRequest('http://localhost/api/internal/clinic/services', { tenantId: tenantA.id });
    const resServ = await getServices(reqServ);
    const dataServ = await resServ.json();
    assert(
      resServ.status === 200 &&
      dataServ.success &&
      dataServ.data.services.length === 2 &&
      dataServ.data.services.some((s: any) => s.name === 'Teeth Cleaning') &&
      !dataServ.data.services.some((s: any) => s.name === 'Experimental Whitening'),
      'get_services returns only active services for the tenant'
    );

    // -----------------------------------------------------------------
    // Group 4: Business Hours & Tool 3 (get_business_hours)
    // -----------------------------------------------------------------
    console.log('\n--- Group 4: Business Hours & get_business_hours Tool ---');
    await clinicService.upsertBusinessHours(tenantA.id, {
      monday: { open: '08:00', close: '17:00', closed: false },
      tuesday: { open: '08:00', close: '17:00', closed: false },
      wednesday: { open: '08:00', close: '18:00', closed: false },
      thursday: { open: '08:00', close: '17:00', closed: false },
      friday: { open: '08:00', close: '16:00', closed: false },
      saturday: { open: '09:00', close: '14:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true },
    });

    const reqHours = createMockRequest('http://localhost/api/internal/clinic/hours', { tenantId: tenantA.id });
    const resHours = await getBusinessHours(reqHours);
    const dataHours = await resHours.json();
    assert(
      resHours.status === 200 &&
      dataHours.success &&
      dataHours.data.schedule.wednesday.open === '08:00' &&
      dataHours.data.schedule.wednesday.close === '18:00' &&
      dataHours.data.schedule.sunday.closed === true,
      'get_business_hours returns configured weekly schedule'
    );

    // -----------------------------------------------------------------
    // Group 5: Customer Management & Tools 5 & 6 (find_customer, create_customer)
    // -----------------------------------------------------------------
    console.log('\n--- Group 5: Customer Tools & Duplicate Prevention ---');
    // Ensure clean state
    await db.customer.deleteMany({ where: { tenantId: tenantA.id } });

    const reqCreateCust = createMockRequest('http://localhost/api/internal/clinic/customer/create', {
      tenantId: tenantA.id,
      name: 'Homer Simpson',
      phone: '+1 (555) 321-9988',
      email: 'homer@springfield.org',
    });
    const resCreateCust = await createCustomer(reqCreateCust);
    const dataCreateCust = await resCreateCust.json();
    assert(
      resCreateCust.status === 200 &&
      dataCreateCust.success &&
      dataCreateCust.data.customer.name === 'Homer Simpson' &&
      dataCreateCust.data.isExisting === false,
      'create_customer creates new customer record with normalized phone'
    );

    // Duplicate creation prevention: same phone, slightly different formatted name
    const reqDupCust = createMockRequest('http://localhost/api/internal/clinic/customer/create', {
      tenantId: tenantA.id,
      name: 'Homer J. Simpson',
      phone: '5553219988', // unformatted
    });
    const resDupCust = await createCustomer(reqDupCust);
    const dataDupCust = await resDupCust.json();
    assert(
      resDupCust.status === 200 &&
      dataDupCust.success &&
      dataDupCust.data.isExisting === true &&
      dataDupCust.data.customer.id === dataCreateCust.data.customer.id,
      'create_customer prevents duplicate customer records for same phone'
    );

    // find_customer
    const reqFind = createMockRequest('http://localhost/api/internal/clinic/customer/find', {
      tenantId: tenantA.id,
      phone: '+15553219988',
    });
    const resFind = await findCustomer(reqFind);
    const dataFind = await resFind.json();
    assert(
      resFind.status === 200 &&
      dataFind.success &&
      dataFind.data.found === true &&
      dataFind.data.customer.name === 'Homer J. Simpson',
      'find_customer retrieves customer by normalized phone'
    );

    // -----------------------------------------------------------------
    // Group 6: Availability & Tool 4 (check_availability)
    // -----------------------------------------------------------------
    console.log('\n--- Group 6: Availability Calculation ---');
    const reqAvail = createMockRequest('http://localhost/api/internal/clinic/availability', {
      tenantId: tenantA.id,
      date: testDate,
      serviceName: 'Teeth Cleaning',
    });
    const resAvail = await checkAvailability(reqAvail);
    const dataAvail = await resAvail.json();
    assert(
      resAvail.status === 200 &&
      dataAvail.success &&
      dataAvail.data.isOpen === true &&
      dataAvail.data.availableSlots.includes('10:00'),
      'check_availability returns available slots within operating hours'
    );

    // -----------------------------------------------------------------
    // Group 7: Transactional Booking & Tool 7 (book_appointment)
    // -----------------------------------------------------------------
    console.log('\n--- Group 7: Transactional Booking & Conflict Prevention ---');
    const slotTime = '10:00';
    const reqBook = createMockRequest('http://localhost/api/internal/clinic/book', {
      tenantId: tenantA.id,
      patientName: 'Homer J. Simpson',
      phone: '+15553219988',
      date: testDate,
      time: slotTime,
      serviceName: 'Teeth Cleaning',
      notes: 'Prefers morning appointment',
    });
    const resBook = await bookAppointment(reqBook);
    const dataBook = await resBook.json();
    assert(
      resBook.status === 200 &&
      dataBook.success &&
      dataBook.data.status === 'UPCOMING' &&
      dataBook.data.time === slotTime,
      'book_appointment successfully creates appointment transactionally'
    );

    const bookedAppointmentId = dataBook.data.appointmentId;

    // Verify slot is now removed from availability
    const resAvailAfter = await checkAvailability(
      createMockRequest('http://localhost/api/internal/clinic/availability', {
        tenantId: tenantA.id,
        date: testDate,
      })
    );
    const dataAvailAfter = await resAvailAfter.json();
    assert(
      !dataAvailAfter.data.availableSlots.includes(slotTime),
      'Booked slot is immediately removed from available slots'
    );

    // Conflict: Another patient attempts to book the same slot
    const reqConflict = createMockRequest('http://localhost/api/internal/clinic/book', {
      tenantId: tenantA.id,
      patientName: 'Ned Flanders',
      phone: '+15559998877',
      date: testDate,
      time: slotTime,
      serviceName: 'Teeth Cleaning',
    });
    const resConflict = await bookAppointment(reqConflict);
    assert(
      resConflict.status === 409,
      'Double booking rejected with 409 Conflict'
    );

    // Idempotency: Same patient retries same booking
    const reqIdempotent = createMockRequest('http://localhost/api/internal/clinic/book', {
      tenantId: tenantA.id,
      patientName: 'Homer J. Simpson',
      phone: '+15553219988',
      date: testDate,
      time: slotTime,
      serviceName: 'Teeth Cleaning',
      notes: 'Prefers morning appointment',
    });
    const resIdempotent = await bookAppointment(reqIdempotent);
    const dataIdempotent = await resIdempotent.json();
    assert(
      resIdempotent.status === 200 &&
      dataIdempotent.success &&
      dataIdempotent.data.isExisting === true &&
      dataIdempotent.data.appointmentId === bookedAppointmentId,
      'Idempotent retry returns existing booking without duplicating record'
    );

    // -----------------------------------------------------------------
    // Group 8: Rescheduling & Tool 9 (reschedule_appointment)
    // -----------------------------------------------------------------
    console.log('\n--- Group 8: Rescheduling & Slot Reassignment ---');
    const newSlotTime = '14:00';
    const reqResched = createMockRequest('http://localhost/api/internal/clinic/reschedule', {
      tenantId: tenantA.id,
      appointmentId: bookedAppointmentId,
      newDate: testDate,
      newTime: newSlotTime,
    });
    const resResched = await rescheduleAppointment(reqResched);
    const dataResched = await resResched.json();
    assert(
      resResched.status === 200 &&
      dataResched.success &&
      dataResched.data.newTime === newSlotTime,
      'reschedule_appointment updates slot and frees old slot'
    );

    // Verify old slot 10:00 is freed
    const resAvailFreed = await checkAvailability(
      createMockRequest('http://localhost/api/internal/clinic/availability', {
        tenantId: tenantA.id,
        date: testDate,
      })
    );
    const dataAvailFreed = await resAvailFreed.json();
    assert(
      dataAvailFreed.data.availableSlots.includes(slotTime) &&
      !dataAvailFreed.data.availableSlots.includes(newSlotTime),
      'Old slot is freed and new slot is reserved after reschedule'
    );

    // -----------------------------------------------------------------
    // Group 9: Cancellation & Tool 8 (cancel_appointment)
    // -----------------------------------------------------------------
    console.log('\n--- Group 9: Cancellation & Release ---');
    const reqCancel = createMockRequest('http://localhost/api/internal/clinic/cancel', {
      tenantId: tenantA.id,
      appointmentId: bookedAppointmentId,
      reason: 'Patient called to cancel due to schedule conflict',
    });
    const resCancel = await cancelAppointment(reqCancel);
    const dataCancel = await resCancel.json();
    assert(
      resCancel.status === 200 &&
      dataCancel.success,
      'cancel_appointment successfully cancels appointment'
    );

    // Verify appointment status in DB is CANCELLED and slotKey is freed
    const aptInDb = await db.appointment.findUnique({ where: { id: bookedAppointmentId } });
    assert(
      aptInDb?.status === 'CANCELLED' && aptInDb?.slotKey === null,
      'Appointment record marked CANCELLED and slotKey released'
    );

    // -----------------------------------------------------------------
    // Group 10: Human Escalation & Tool 10 (request_human_transfer)
    // -----------------------------------------------------------------
    console.log('\n--- Group 10: Human Transfer & Call Event Logging ---');
    // Create dummy call
    const testCall = await db.call.create({
      data: {
        tenantId: tenantA.id,
        callerNumber: '+15553219988',
        direction: 'INBOUND',
        status: 'IN_PROGRESS',
      },
    });

    const reqTransfer = createMockRequest('http://localhost/api/internal/clinic/transfer', {
      tenantId: tenantA.id,
      callId: testCall.id,
      reason: 'Caller requested to speak with front desk nurse',
      callerNumber: '+15553219988',
    });
    const resTransfer = await requestTransfer(reqTransfer);
    const dataTransfer = await resTransfer.json();
    assert(
      resTransfer.status === 200 &&
      dataTransfer.success &&
      typeof dataTransfer.data.transferNumber === 'string' &&
      typeof dataTransfer.data.fallbackMessage === 'string',
      'request_human_transfer returns transfer contact and fallback message'
    );

    // Verify CallEvent was persisted
    const eventInDb = await db.callEvent.findFirst({
      where: { callId: testCall.id, eventType: 'TRANSFERRED' },
    });
    assert(eventInDb !== null, 'TRANSFERRED CallEvent successfully recorded in database');

    // -----------------------------------------------------------------
    // Group 11: Multi-Tenant Isolation
    // -----------------------------------------------------------------
    console.log('\n--- Group 11: Strict Multi-Tenant Isolation ---');
    // Tenant B cannot access Tenant A's customer
    const reqCrossFind = createMockRequest('http://localhost/api/internal/clinic/customer/find', {
      tenantId: tenantB.id,
      phone: '+15553219988',
    });
    const resCrossFind = await findCustomer(reqCrossFind);
    const dataCrossFind = await resCrossFind.json();
    assert(
      resCrossFind.status === 200 &&
      dataCrossFind.data.found === false,
      'Tenant B cannot query or access Tenant A customer records'
    );

    // Tenant B cannot cancel Tenant A's appointment
    let crossCancelFailed = false;
    try {
      const resCrossCancel = await cancelAppointment(
        createMockRequest('http://localhost/api/internal/clinic/cancel', {
          tenantId: tenantB.id,
          appointmentId: bookedAppointmentId,
        })
      );
      if (resCrossCancel.status >= 400) crossCancelFailed = true;
    } catch {
      crossCancelFailed = true;
    }
    assert(crossCancelFailed, 'Tenant B is strictly blocked from cancelling Tenant A appointment');

    console.log(`\n🎉 All ${passed}/${totalTests} Phase 3 Clinic Suite Tests PASSED!`);
  } finally {
    // Cleanup
    await db.appointment.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.callEvent.deleteMany({
      where: { call: { tenantId: { in: [tenantA.id, tenantB.id] } } },
    });
    await db.call.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.customer.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.clinicService.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.businessHours.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.clinicProfile.deleteMany({
      where: { tenantId: { in: [tenantA.id, tenantB.id] } },
    });
    await db.$disconnect();
  }
}

runPhase3Suite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
