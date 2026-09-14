import { db } from '@/lib/db';
import { EntitlementCheckResult } from '@/types';

export async function getTenantEntitlement(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1,
      },
    },
  });

  if (!tenant || !tenant.subscriptions[0]) {
    // Default fallback to Free limits
    return {
      maxAgents: 1,
      monthlyMinutes: 30,
      maxUsers: 1,
      maxPhoneNumbers: 1,
      maxConcurrentCalls: 1,
      knowledgeStorageMb: 20,
    };
  }

  const plan = tenant.subscriptions[0].plan;
  return {
    planName: plan.name,
    planCode: plan.code,
    maxAgents: plan.maxAgents,
    monthlyMinutes: plan.monthlyMinutes,
    maxUsers: plan.maxUsers,
    maxPhoneNumbers: plan.maxPhoneNumbers,
    maxConcurrentCalls: plan.maxConcurrentCalls,
    knowledgeStorageMb: plan.knowledgeStorageMb,
  };
}

export async function getTenantUsageSummary(tenantId: string) {
  const entitlements = await getTenantEntitlement(tenantId);

  // Calculate minutes used in the current calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const minuteRecords = await db.usageRecord.aggregate({
    where: {
      tenantId,
      metricType: 'VOICE_MINUTES',
      timestamp: { gte: startOfMonth },
    },
    _sum: { quantity: true },
  });

  const minutesUsed = Math.round((minuteRecords._sum.quantity || 0) * 10) / 10;
  const minutesLimit = entitlements.monthlyMinutes;
  const minutesPct = Math.min(100, Math.round((minutesUsed / minutesLimit) * 100));

  // Count active agents
  const agentsCount = await db.agent.count({
    where: { tenantId, status: { not: 'ARCHIVED' } },
  });

  // Count team members
  const usersCount = await db.tenantMember.count({
    where: { tenantId },
  });

  // Count phone numbers
  const phoneNumbersCount = await db.phoneNumber.count({
    where: { tenantId, status: 'ACTIVE' },
  });

  // Calculate storage used
  const storageRecords = await db.knowledgeDocument.aggregate({
    where: { tenantId },
    _sum: { sizeBytes: true },
  });
  const storageMbUsed = Math.round(((storageRecords._sum.sizeBytes || 0) / (1024 * 1024)) * 10) / 10;

  // Threshold alert computation (70%, 85%, 95%, 100%)
  let thresholdAlert: '70%' | '85%' | '95%' | '100%' | null = null;
  if (minutesPct >= 100) thresholdAlert = '100%';
  else if (minutesPct >= 95) thresholdAlert = '95%';
  else if (minutesPct >= 85) thresholdAlert = '85%';
  else if (minutesPct >= 70) thresholdAlert = '70%';

  return {
    entitlements,
    voice: {
      used: minutesUsed,
      limit: minutesLimit,
      remaining: Math.max(0, minutesLimit - minutesUsed),
      percentage: minutesPct,
      thresholdAlert,
    },
    agents: {
      used: agentsCount,
      limit: entitlements.maxAgents,
      percentage: Math.min(100, Math.round((agentsCount / entitlements.maxAgents) * 100)),
    },
    users: {
      used: usersCount,
      limit: entitlements.maxUsers,
      percentage: Math.min(100, Math.round((usersCount / entitlements.maxUsers) * 100)),
    },
    phoneNumbers: {
      used: phoneNumbersCount,
      limit: entitlements.maxPhoneNumbers,
      percentage: Math.min(100, Math.round((phoneNumbersCount / entitlements.maxPhoneNumbers) * 100)),
    },
    storage: {
      usedMb: storageMbUsed,
      limitMb: entitlements.knowledgeStorageMb,
      percentage: Math.min(100, Math.round((storageMbUsed / entitlements.knowledgeStorageMb) * 100)),
    },
  };
}

export async function checkEntitlement(
  tenantId: string,
  feature: 'VOICE_MINUTES' | 'AGENTS' | 'USERS' | 'PHONE_NUMBERS'
): Promise<EntitlementCheckResult> {
  const usage = await getTenantUsageSummary(tenantId);

  switch (feature) {
    case 'VOICE_MINUTES':
      return {
        allowed: usage.voice.used < usage.voice.limit,
        currentUsage: usage.voice.used,
        limit: usage.voice.limit,
        percentageUsed: usage.voice.percentage,
        metric: 'Voice Minutes',
        warningThreshold: usage.voice.thresholdAlert,
      };
    case 'AGENTS':
      return {
        allowed: usage.agents.used < usage.agents.limit,
        currentUsage: usage.agents.used,
        limit: usage.agents.limit,
        percentageUsed: usage.agents.percentage,
        metric: 'Voice Agents',
      };
    case 'USERS':
      return {
        allowed: usage.users.used < usage.users.limit,
        currentUsage: usage.users.used,
        limit: usage.users.limit,
        percentageUsed: usage.users.percentage,
        metric: 'Team Members',
      };
    case 'PHONE_NUMBERS':
      return {
        allowed: usage.phoneNumbers.used < usage.phoneNumbers.limit,
        currentUsage: usage.phoneNumbers.used,
        limit: usage.phoneNumbers.limit,
        percentageUsed: usage.phoneNumbers.percentage,
        metric: 'Phone Numbers',
      };
  }
}

export async function recordUsage(tenantId: string, metricType: string, quantity: number, callId?: string) {
  return db.usageRecord.create({
    data: {
      tenantId,
      metricType,
      quantity,
      callId,
    },
  });
}
