import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.callTranscript.deleteMany();
  await prisma.callEvent.deleteMany();
  await prisma.call.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.knowledgeDocument.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.agentVersion.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.usageRecord.deleteMany();
  await prisma.tenantSubscription.deleteMany();
  await prisma.tenantMember.deleteMany();
  await prisma.tenantSetting.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformUser.deleteMany();
  await prisma.plan.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Create Plans
  const freePlan = await prisma.plan.create({
    data: {
      code: 'FREE',
      name: 'Free Trial',
      description: 'Test out voice agents with basic features',
      priceMonthly: 0,
      maxAgents: 1,
      monthlyMinutes: 30,
      maxUsers: 1,
      maxPhoneNumbers: 1,
      maxConcurrentCalls: 1,
      knowledgeStorageMb: 20,
      integrationsAllowed: 1,
    },
  });

  const starterPlan = await prisma.plan.create({
    data: {
      code: 'STARTER',
      name: 'Starter Tier',
      description: 'Ideal for small clinics and independent practices',
      priceMonthly: 99,
      maxAgents: 3,
      monthlyMinutes: 500,
      maxUsers: 3,
      maxPhoneNumbers: 2,
      maxConcurrentCalls: 3,
      knowledgeStorageMb: 100,
      integrationsAllowed: 3,
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      code: 'PRO',
      name: 'Professional',
      description: 'High-volume voice automation with AI tools and scheduling',
      priceMonthly: 299,
      maxAgents: 10,
      monthlyMinutes: 2500,
      maxUsers: 10,
      maxPhoneNumbers: 5,
      maxConcurrentCalls: 8,
      knowledgeStorageMb: 500,
      integrationsAllowed: 10,
    },
  });

  const businessPlan = await prisma.plan.create({
    data: {
      code: 'BUSINESS',
      name: 'Enterprise / Business',
      description: 'Unlimited scalability, custom integrations, and dedicated SLAs',
      priceMonthly: 799,
      maxAgents: 50,
      monthlyMinutes: 10000,
      maxUsers: 50,
      maxPhoneNumbers: 25,
      maxConcurrentCalls: 30,
      knowledgeStorageMb: 5000,
      integrationsAllowed: 50,
    },
  });

  // 3. Create Platform Super Admin
  const platformAdmin = await prisma.platformUser.create({
    data: {
      email: 'admin@zcallagent.ai',
      passwordHash,
      name: 'Alex Mercer (Platform Admin)',
      role: 'SUPER_ADMIN',
    },
  });

  // 4. Create Tenant A: Apex Dental Care
  const tenantA = await prisma.tenant.create({
    data: {
      name: 'Apex Dental Care',
      legalName: 'Apex Dental Group LLC',
      industry: 'Healthcare / Dental',
      website: 'https://apexdental.example.com',
      email: 'contact@apexdental.example.com',
      phone: '+1 (555) 234-5678',
      timezone: 'America/New_York',
      address: '742 Evergreen Terrace, Suite 300',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      status: 'ACTIVE',
      planId: proPlan.id,
      settings: {
        create: {
          retentionDays: 90,
          defaultCallerId: '+1 (555) 234-5678',
          recordCalls: true,
          autoTranscribe: true,
          aiSummaryEnabled: true,
          notificationEmail: 'alerts@apexdental.example.com',
        },
      },
    },
  });

  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenantA.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const userAOwner = await prisma.user.create({
    data: {
      email: 'owner@apexdental.com',
      passwordHash,
      name: 'Dr. Evelyn Reed',
    },
  });

  await prisma.tenantMember.create({
    data: {
      tenantId: tenantA.id,
      userId: userAOwner.id,
      role: 'OWNER',
    },
  });

  const userAStaff = await prisma.user.create({
    data: {
      email: 'sarah@apexdental.com',
      passwordHash,
      name: 'Sarah Connor (Staff)',
    },
  });

  await prisma.tenantMember.create({
    data: {
      tenantId: tenantA.id,
      userId: userAStaff.id,
      role: 'STAFF',
    },
  });

  // Voice Agent for Tenant A
  const agentA = await prisma.agent.create({
    data: {
      tenantId: tenantA.id,
      name: 'Chloe - Dental Reception & Scheduling',
      type: 'APPOINTMENT_BOOKING',
      status: 'ACTIVE',
    },
  });

  const agentAVersion = await prisma.agentVersion.create({
    data: {
      agentId: agentA.id,
      versionNumber: 1,
      changeSummary: 'Initial production configuration with scheduling and insurance FAQ',
      greeting: "Hello! Thank you for calling Apex Dental Care. I'm Chloe, your AI dental assistant. How can I help you today?",
      closingMessage: 'Thank you for calling Apex Dental Care. Have a wonderful and healthy day!',
      prompt: 'You are Chloe, an expert, polite, and reassuring receptionist for Apex Dental Care. Your primary goal is to book checkups, cleanings, and consultations.',
      systemInstructions: 'Always verify patient phone number and insurance status. Keep answers concise, natural, and friendly.',
      personality: 'Warm, reassuring, professional, efficient',
      tone: 'friendly',
      voiceProvider: 'Cartesia',
      voiceId: 'sonic-english-female',
      voiceLanguage: 'en-US',
      voiceSpeed: 1.0,
      aiModel: 'gpt-4o-mini',
      temperature: 0.6,
      maxTokens: 400,
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: userAOwner.id,
      toolsConfigJson: JSON.stringify({
        check_availability: true,
        book_appointment: true,
        reschedule_appointment: true,
        cancel_appointment: true,
        transfer_call: true,
      }),
      businessHoursJson: JSON.stringify({
        enabled: true,
        timezone: 'America/New_York',
        schedule: {
          monday: { open: '08:00', close: '18:00', closed: false },
          tuesday: { open: '08:00', close: '18:00', closed: false },
          wednesday: { open: '08:00', close: '18:00', closed: false },
          thursday: { open: '08:00', close: '18:00', closed: false },
          friday: { open: '08:00', close: '17:00', closed: false },
          saturday: { open: '09:00', close: '13:00', closed: false },
          sunday: { open: '00:00', close: '00:00', closed: true },
        },
        afterHoursAction: 'take_message_or_emergency_transfer',
      }),
      transferRulesJson: JSON.stringify({
        primaryNumber: '+1 (555) 234-9999',
        fallbackNumber: '+1 (555) 234-8888',
        timeoutSeconds: 25,
        handoffMessage: 'Please hold while I connect you directly to our clinical emergency nurse.',
      }),
    },
  });

  await prisma.agent.update({
    where: { id: agentA.id },
    data: { currentVersionId: agentAVersion.id },
  });

  const phoneA = await prisma.phoneNumber.create({
    data: {
      tenantId: tenantA.id,
      number: '+15552345678',
      formatted: '+1 (555) 234-5678',
      provider: 'Twilio',
      assignedAgentId: agentA.id,
      status: 'ACTIVE',
      incomingCount: 142,
      outgoingCount: 8,
    },
  });

  await prisma.agent.update({
    where: { id: agentA.id },
    data: { assignedPhoneNumberId: phoneA.id },
  });

  // Customers for Tenant A
  const custA1 = await prisma.customer.create({
    data: {
      tenantId: tenantA.id,
      name: 'John Miller',
      phone: '+1 (555) 301-4411',
      email: 'john.miller@example.com',
      tags: JSON.stringify(['VIP', 'Delta Dental', 'Regular']),
      notes: 'Prefers morning appointments. Mild dental anxiety.',
      totalCalls: 3,
      totalSpent: 450,
      lastContactedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  const custA2 = await prisma.customer.create({
    data: {
      tenantId: tenantA.id,
      name: 'Emily Chen',
      phone: '+1 (555) 302-8822',
      email: 'emily.chen@example.com',
      tags: JSON.stringify(['Whitening', 'MetLife']),
      notes: 'Interested in cosmetic veneers and whitening.',
      totalCalls: 2,
      totalSpent: 890,
      lastContactedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });

  // Appointments for Tenant A
  await prisma.appointment.create({
    data: {
      tenantId: tenantA.id,
      customerId: custA1.id,
      agentId: agentA.id,
      title: 'Bi-annual Hygiene & Exam',
      serviceName: 'Routine Dental Cleaning',
      date: '2026-09-15',
      time: '10:30',
      durationMinutes: 45,
      status: 'UPCOMING',
      notes: 'Booked automatically via Voice Agent Chloe.',
    },
  });

  await prisma.appointment.create({
    data: {
      tenantId: tenantA.id,
      customerId: custA2.id,
      agentId: agentA.id,
      title: 'Cosmetic Consultation',
      serviceName: 'Teeth Whitening Consultation',
      date: '2026-09-18',
      time: '14:00',
      durationMinutes: 30,
      status: 'UPCOMING',
      notes: 'Booked via Chloe.',
    },
  });

  // Calls for Tenant A
  const callA1 = await prisma.call.create({
    data: {
      tenantId: tenantA.id,
      agentId: agentA.id,
      agentVersionId: agentAVersion.id,
      callerNumber: '+1 (555) 301-4411',
      callerName: 'John Miller',
      recipientNumber: '+1 (555) 234-5678',
      direction: 'INBOUND',
      status: 'COMPLETED',
      durationSeconds: 164,
      intent: 'Book Appointment',
      outcome: 'APPOINTMENT_BOOKED',
      sentiment: 'POSITIVE',
      summary: 'Patient John Miller called to schedule a routine dental cleaning. Chloe verified availability for tomorrow morning and successfully booked 10:30 AM.',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 164 * 1000),
      recordingUrl: 'https://storage.zcallagent.ai/recordings/demo_apex_01.mp3',
    },
  });

  await prisma.callTranscript.createMany({
    data: [
      {
        callId: callA1.id,
        speaker: 'AGENT',
        message: "Hello! Thank you for calling Apex Dental Care. I'm Chloe, your AI assistant. How can I help you today?",
        timestampOffsetMs: 0,
      },
      {
        callId: callA1.id,
        speaker: 'CUSTOMER',
        message: "Hi Chloe! I'd like to schedule an appointment for a teeth cleaning tomorrow if possible.",
        timestampOffsetMs: 5200,
      },
      {
        callId: callA1.id,
        speaker: 'AGENT',
        message: 'I would be happy to help with that. Let me quickly check our chair availability for tomorrow.',
        toolInvocation: 'check_availability(date="2026-09-15", service="Cleaning")',
        toolResult: '{"available_slots":["10:30 AM", "02:00 PM", "04:15 PM"]}',
        latencyMs: 380,
        timestampOffsetMs: 11000,
      },
      {
        callId: callA1.id,
        speaker: 'AGENT',
        message: 'We have 10:30 AM, 2:00 PM, and 4:15 PM open tomorrow. Would 10:30 AM work well for you?',
        timestampOffsetMs: 15400,
      },
      {
        callId: callA1.id,
        speaker: 'CUSTOMER',
        message: "10:30 AM is perfect. My name is John Miller.",
        timestampOffsetMs: 21000,
      },
      {
        callId: callA1.id,
        speaker: 'AGENT',
        message: 'Wonderful, John. I have confirmed your routine dental cleaning for tomorrow at 10:30 AM.',
        toolInvocation: 'book_appointment(name="John Miller", date="2026-09-15", time="10:30", phone="+15553014411")',
        toolResult: '{"status":"CONFIRMED","appointmentId":"apt_apex_01"}',
        latencyMs: 410,
        timestampOffsetMs: 27500,
      },
      {
        callId: callA1.id,
        speaker: 'CUSTOMER',
        message: 'Awesome, thanks so much Chloe!',
        timestampOffsetMs: 33000,
      },
      {
        callId: callA1.id,
        speaker: 'AGENT',
        message: 'You are very welcome, John. Have a wonderful day!',
        timestampOffsetMs: 36000,
      },
    ],
  });

  // Usage records for Tenant A
  await prisma.usageRecord.create({
    data: {
      tenantId: tenantA.id,
      metricType: 'VOICE_MINUTES',
      quantity: 2.73,
      callId: callA1.id,
      notes: 'Call duration 164s billed at standard minute rate',
    },
  });

  // Add more usage to show ~65% usage
  await prisma.usageRecord.create({
    data: {
      tenantId: tenantA.id,
      metricType: 'VOICE_MINUTES',
      quantity: 1625,
      notes: 'Aggregated monthly usage records',
    },
  });

  // Knowledge Document for Tenant A
  await prisma.knowledgeDocument.create({
    data: {
      tenantId: tenantA.id,
      title: 'Apex Dental Practice Policies & Insurances 2026',
      type: 'PDF',
      sizeBytes: 245760,
      status: 'READY',
      chunkCount: 18,
      lastIndexedAt: new Date(),
      content: 'Apex Dental accepts Delta Dental, MetLife, Cigna, Guardian, and Aetna PPO plans...',
    },
  });

  // Integrations for Tenant A
  await prisma.integration.create({
    data: {
      tenantId: tenantA.id,
      provider: 'GOOGLE_CALENDAR',
      name: 'Google Calendar (Clinic Main)',
      status: 'CONNECTED',
      lastSyncAt: new Date(),
      configJson: JSON.stringify({ calendarId: 'primary@apexdental.example.com', autoSync: true }),
    },
  });

  // -----------------------------------------------------------------
  // 5. Create Tenant B: Metro Health Clinic (Isolate Data for Testing)
  // -----------------------------------------------------------------
  const tenantB = await prisma.tenant.create({
    data: {
      name: 'Metro Health Clinic',
      legalName: 'Metro Health Partners PC',
      industry: 'Urgent Care & Family Medicine',
      website: 'https://metrohealth.example.com',
      email: 'admin@metrohealth.example.com',
      phone: '+1 (555) 987-6543',
      timezone: 'America/Chicago',
      address: '100 Michigan Ave',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      status: 'ACTIVE',
      planId: starterPlan.id,
      settings: {
        create: {
          retentionDays: 60,
          defaultCallerId: '+1 (555) 987-6543',
          recordCalls: true,
          autoTranscribe: true,
          aiSummaryEnabled: true,
          notificationEmail: 'alerts@metrohealth.example.com',
        },
      },
    },
  });

  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenantB.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const userBOwner = await prisma.user.create({
    data: {
      email: 'owner@metrohealth.com',
      passwordHash,
      name: 'Dr. Robert Vance',
    },
  });

  await prisma.tenantMember.create({
    data: {
      tenantId: tenantB.id,
      userId: userBOwner.id,
      role: 'OWNER',
    },
  });

  const agentB = await prisma.agent.create({
    data: {
      tenantId: tenantB.id,
      name: 'Liam - Urgent Care Triage',
      type: 'CUSTOMER_SUPPORT',
      status: 'ACTIVE',
    },
  });

  await prisma.agentVersion.create({
    data: {
      agentId: agentB.id,
      versionNumber: 1,
      greeting: "Hello, Metro Health Triage. I'm Liam.",
      prompt: 'You are Liam, urgent care nurse assistant for Metro Health Clinic.',
      voiceProvider: 'Cartesia',
      voiceId: 'sonic-english-male',
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: userBOwner.id,
    },
  });

  await prisma.phoneNumber.create({
    data: {
      tenantId: tenantB.id,
      number: '+15559876543',
      formatted: '+1 (555) 987-6543',
      provider: 'Twilio',
      assignedAgentId: agentB.id,
      status: 'ACTIVE',
    },
  });

  // Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId: tenantA.id,
      actorId: userAOwner.id,
      actorEmail: userAOwner.email,
      actorType: 'TENANT_MEMBER',
      action: 'AGENT_PUBLISHED',
      resource: 'agent',
      resourceId: agentA.id,
      changes: JSON.stringify({ version: 1, name: agentA.name }),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: null,
      actorId: platformAdmin.id,
      actorEmail: platformAdmin.email,
      actorType: 'PLATFORM_USER',
      action: 'TENANT_CREATED',
      resource: 'tenant',
      resourceId: tenantA.id,
      changes: JSON.stringify({ tenantName: tenantA.name, plan: 'PRO' }),
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('Super Admin: admin@zcallagent.ai (Password123!)');
  console.log('Tenant A:    owner@apexdental.com (Password123!)');
  console.log('Tenant B:    owner@metrohealth.com (Password123!)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
