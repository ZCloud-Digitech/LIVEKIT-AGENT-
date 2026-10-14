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

export interface SubscriptionBillingSummary {
  planName: string;
  planCode: string;
  basePriceMonthly: number;
  includedMinutes: number;
  usedMinutes: number;
  overageMinutes: number;
  overageRatePerMinute: number;
  overageCost: number;
  isByokActive: boolean;
  totalEstimatedAmount: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}

export async function calculateSubscriptionBilling(tenantId: string): Promise<SubscriptionBillingSummary> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1,
      },
      integrations: {
        where: { status: 'CONNECTED', provider: { startsWith: 'BYOK_' } },
      },
    },
  });

  const sub = tenant?.subscriptions[0];
  const plan = sub?.plan;
  const isByokActive = (tenant?.integrations?.length || 0) > 0;

  const basePrice = plan?.priceMonthly || 0;
  const includedMinutes = plan?.monthlyMinutes || 100;
  const periodStart = sub?.currentPeriodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = sub?.currentPeriodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const minuteRecords = await db.usageRecord.aggregate({
    where: {
      tenantId,
      metricType: 'VOICE_MINUTES',
      timestamp: { gte: periodStart },
    },
    _sum: { quantity: true },
  });

  const usedMinutes = Math.round((minuteRecords._sum.quantity || 0) * 10) / 10;
  const overageMinutes = Math.max(0, Math.round((usedMinutes - includedMinutes) * 10) / 10);

  // Bundled overage rate: $0.05/min. If BYOK active, platform compute fee is reduced to $0.015/min.
  const overageRatePerMinute = isByokActive ? 0.015 : 0.05;
  const overageCost = Math.round(overageMinutes * overageRatePerMinute * 100) / 100;
  const totalEstimatedAmount = Math.round((basePrice + overageCost) * 100) / 100;

  return {
    planName: plan?.name || 'Starter Plan',
    planCode: plan?.code || 'STARTER',
    basePriceMonthly: basePrice,
    includedMinutes,
    usedMinutes,
    overageMinutes,
    overageRatePerMinute,
    overageCost,
    isByokActive,
    totalEstimatedAmount,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
  };
}

export async function enforceRecordingRetention(tenantId: string): Promise<{
  deletedRecordingsCount: number;
  deletedStorageFilesCount: number;
}> {
  const setting = await db.tenantSetting.findUnique({ where: { tenantId } });
  const retentionDays = setting?.retentionDays ?? 90;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expiredCalls = await db.call.findMany({
    where: {
      tenantId,
      startedAt: { lt: cutoff },
      recordingUrl: { not: null },
    },
    select: { id: true, recordingUrl: true },
  });

  let deletedStorageFilesCount = 0;
  const fs = await import('fs');
  const path = await import('path');

  for (const call of expiredCalls) {
    if (!call.recordingUrl) continue;

    try {
      let targetPath: string | null = null;
      if (call.recordingUrl.startsWith('file://')) {
        targetPath = call.recordingUrl.replace(/^file:\/\//, '');
      } else if (
        call.recordingUrl.startsWith('/') ||
        call.recordingUrl.startsWith('./') ||
        call.recordingUrl.includes('recordings')
      ) {
        targetPath = path.isAbsolute(call.recordingUrl)
          ? call.recordingUrl
          : path.resolve(process.cwd(), call.recordingUrl);
      }

      if (targetPath && fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        deletedStorageFilesCount++;
      }
    } catch (err: any) {
      console.warn(`[Retention Enforcement] Notice: Could not remove audio file for call ${call.id}: ${err.message}`);
    }
  }

  if (expiredCalls.length > 0) {
    await db.call.updateMany({
      where: {
        id: { in: expiredCalls.map((c) => c.id) },
      },
      data: {
        recordingUrl: null, // Wipe recording URL while preserving transcript compliance logs
      },
    });
  }

  return {
    deletedRecordingsCount: expiredCalls.length,
    deletedStorageFilesCount,
  };
}
