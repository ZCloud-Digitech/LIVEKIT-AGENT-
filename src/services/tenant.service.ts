import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { recordAuditLog } from './audit.service';

export interface OnboardingWizardInput {
  business: {
    name: string;
    legalName?: string;
    industry: string;
    website?: string;
    email: string;
    phone: string;
    country: string;
    timezone: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    description?: string;
  };
  contact: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };
  planId: string;
  adminUser: {
    name: string;
    email: string;
    password?: string;
  };
  voiceAgent: {
    name: string;
    type: string;
    greeting: string;
    prompt: string;
    voiceProvider: string;
    voiceId: string;
    language: string;
  };
  tools: Record<string, boolean>;
  phoneNumber?: string;
}

export async function listTenants(params?: {
  search?: string;
  status?: string;
  planId?: string;
  industry?: string;
}) {
  const where: any = {};

  if (params?.status) {
    where.status = params.status;
  }

  if (params?.planId) {
    where.planId = params.planId;
  }

  if (params?.industry) {
    where.industry = { contains: params.industry };
  }

  if (params?.search) {
    where.OR = [
      { name: { contains: params.search } },
      { email: { contains: params.search } },
      { phone: { contains: params.search } },
      { id: { contains: params.search } },
    ];
  }

  return db.tenant.findMany({
    where,
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1,
      },
      _count: {
        select: {
          agents: true,
          calls: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTenantById(tenantId: string) {
  return db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      settings: true,
      subscriptions: {
        include: { plan: true },
      },
      members: {
        include: { user: true },
      },
      agents: {
        include: {
          versions: {
            where: { isPublished: true },
            take: 1,
          },
        },
      },
      phoneNumbers: true,
      integrations: true,
      knowledgeDocs: true,
      _count: {
        select: {
          calls: true,
          appointments: true,
          customers: true,
          auditLogs: true,
        },
      },
    },
  });
}

export async function createTenantWithWizard(
  input: OnboardingWizardInput,
  actor: { id: string; email: string }
) {
  const passwordHash = await hashPassword(input.adminUser.password || 'TemporaryPassword123!');

  // 1. Create Tenant
  const tenant = await db.tenant.create({
    data: {
      name: input.business.name,
      legalName: input.business.legalName,
      industry: input.business.industry,
      website: input.business.website,
      email: input.business.email,
      phone: input.business.phone,
      country: input.business.country || 'US',
      timezone: input.business.timezone || 'America/New_York',
      address: input.business.address,
      city: input.business.city,
      state: input.business.state,
      postalCode: input.business.postalCode,
      description: input.business.description,
      status: 'ACTIVE',
      planId: input.planId,
      settings: {
        create: {
          retentionDays: 90,
          recordCalls: true,
          autoTranscribe: true,
          aiSummaryEnabled: true,
          notificationEmail: input.business.email,
        },
      },
    },
  });

  // 2. Subscription
  await db.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: input.planId,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. User & Member
  let user = await db.user.findUnique({
    where: { email: input.adminUser.email },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        name: input.adminUser.name,
        email: input.adminUser.email,
        passwordHash,
      },
    });
  }

  await db.tenantMember.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  // 4. Voice Agent & Initial Published Version
  const agent = await db.agent.create({
    data: {
      tenantId: tenant.id,
      name: input.voiceAgent.name,
      type: input.voiceAgent.type || 'INBOUND',
      status: 'ACTIVE',
    },
  });

  const version = await db.agentVersion.create({
    data: {
      agentId: agent.id,
      versionNumber: 1,
      changeSummary: 'Initial onboarding configuration',
      greeting: input.voiceAgent.greeting,
      prompt: input.voiceAgent.prompt,
      voiceProvider: input.voiceAgent.voiceProvider || 'Cartesia',
      voiceId: input.voiceAgent.voiceId || 'sonic-english',
      voiceLanguage: input.voiceAgent.language || 'en-US',
      toolsConfigJson: JSON.stringify(input.tools || {}),
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: actor.id,
    },
  });

  await db.agent.update({
    where: { id: agent.id },
    data: { currentVersionId: version.id },
  });

  // 5. Phone Number (if provided)
  if (input.phoneNumber) {
    const cleanNum = input.phoneNumber.replace(/[^0-9+]/g, '');
    const phone = await db.phoneNumber.create({
      data: {
        tenantId: tenant.id,
        number: cleanNum,
        formatted: input.phoneNumber,
        assignedAgentId: agent.id,
        status: 'ACTIVE',
      },
    });

    await db.agent.update({
      where: { id: agent.id },
      data: { assignedPhoneNumberId: phone.id },
    });
  }

  // 6. Audit Log
  await recordAuditLog({
    tenantId: tenant.id,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'PLATFORM_USER',
    action: 'TENANT_ONBOARDED',
    resource: 'tenant',
    resourceId: tenant.id,
    changes: { name: tenant.name, planId: input.planId },
  });

  return tenant;
}

export async function updateTenantStatus(
  tenantId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  actor: { id: string; email: string }
) {
  const updated = await db.tenant.update({
    where: { id: tenantId },
    data: { status },
  });

  await recordAuditLog({
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'PLATFORM_USER',
    action: `TENANT_${status}`,
    resource: 'tenant',
    resourceId: tenantId,
  });

  return updated;
}
