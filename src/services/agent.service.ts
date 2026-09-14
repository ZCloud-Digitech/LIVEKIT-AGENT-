import { db } from '@/lib/db';
import { recordAuditLog } from './audit.service';
import { checkEntitlement } from './entitlement.service';

export async function listAgents(tenantId: string) {
  return db.agent.findMany({
    where: { tenantId, status: { not: 'ARCHIVED' } },
    include: {
      versions: {
        where: { isPublished: true },
        take: 1,
      },
      _count: {
        select: {
          calls: true,
          appointments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAgentById(tenantId: string, agentId: string) {
  const agent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
      },
      calls: {
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!agent) return null;

  // Get current active/published version or latest version
  const currentVersion =
    agent.versions.find((v) => v.id === agent.currentVersionId) ||
    agent.versions.find((v) => v.isPublished) ||
    agent.versions[0];

  return {
    ...agent,
    currentVersion,
  };
}

export async function createAgent(
  tenantId: string,
  data: {
    name: string;
    type?: string;
    greeting?: string;
    prompt?: string;
    voiceProvider?: string;
    voiceId?: string;
  },
  actor: { id: string; email: string }
) {
  // Check agent quota
  const entitlement = await checkEntitlement(tenantId, 'AGENTS');
  if (!entitlement.allowed) {
    throw new Error(`Agent limit reached for your plan (${entitlement.currentUsage}/${entitlement.limit}). Please upgrade.`);
  }

  const agent = await db.agent.create({
    data: {
      tenantId,
      name: data.name,
      type: data.type || 'INBOUND',
      status: 'CONFIGURING',
    },
  });

  const version = await db.agentVersion.create({
    data: {
      agentId: agent.id,
      versionNumber: 1,
      changeSummary: 'Initial draft version',
      greeting: data.greeting || 'Hello, how can I help you today?',
      prompt: data.prompt || 'You are a professional voice agent.',
      voiceProvider: data.voiceProvider || 'Cartesia',
      voiceId: data.voiceId || 'sonic-english',
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: actor.id,
    },
  });

  await db.agent.update({
    where: { id: agent.id },
    data: { currentVersionId: version.id, status: 'ACTIVE' },
  });

  await recordAuditLog({
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'TENANT_MEMBER',
    action: 'AGENT_CREATED',
    resource: 'agent',
    resourceId: agent.id,
    changes: { name: agent.name },
  });

  return getAgentById(tenantId, agent.id);
}

export async function saveAgentConfigurationDraft(
  tenantId: string,
  agentId: string,
  config: any,
  actor: { id: string; email: string }
) {
  const agent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  });

  if (!agent) throw new Error('Agent not found or unauthorized.');

  const latestVersion = agent.versions[0];
  const nextVersionNum = (latestVersion?.versionNumber || 0) + 1;

  // Create a new version snapshot
  const newVersion = await db.agentVersion.create({
    data: {
      agentId: agent.id,
      versionNumber: nextVersionNum,
      changeSummary: config.changeSummary || `Version ${nextVersionNum} update`,
      greeting: config.greeting,
      closingMessage: config.closingMessage,
      prompt: config.prompt,
      systemInstructions: config.systemInstructions,
      personality: config.personality,
      tone: config.tone,
      voiceProvider: config.voiceProvider,
      voiceId: config.voiceId,
      voiceLanguage: config.voiceLanguage,
      voiceSpeed: config.voiceSpeed ? parseFloat(config.voiceSpeed) : 1.0,
      aiModel: config.aiModel,
      temperature: config.temperature ? parseFloat(config.temperature) : 0.7,
      maxTokens: config.maxTokens ? parseInt(config.maxTokens) : 500,
      silenceTimeoutMs: config.silenceTimeoutMs ? parseInt(config.silenceTimeoutMs) : 2000,
      greetingTimeoutMs: config.greetingTimeoutMs ? parseInt(config.greetingTimeoutMs) : 4000,
      maxDurationSeconds: config.maxDurationSeconds ? parseInt(config.maxDurationSeconds) : 600,
      fallbackBehavior: config.fallbackBehavior,
      businessHoursJson: typeof config.businessHours === 'object' ? JSON.stringify(config.businessHours) : config.businessHoursJson,
      transferRulesJson: typeof config.transferRules === 'object' ? JSON.stringify(config.transferRules) : config.transferRulesJson,
      toolsConfigJson: typeof config.tools === 'object' ? JSON.stringify(config.tools) : config.toolsConfigJson,
      isPublished: false,
    },
  });

  await recordAuditLog({
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'TENANT_MEMBER',
    action: 'AGENT_VERSION_CREATED',
    resource: 'agent_version',
    resourceId: newVersion.id,
    changes: { versionNumber: nextVersionNum },
  });

  return newVersion;
}

export async function publishAgentVersion(
  tenantId: string,
  agentId: string,
  versionId: string,
  actor: { id: string; email: string }
) {
  const version = await db.agentVersion.findFirst({
    where: { id: versionId, agentId, agent: { tenantId } },
  });

  if (!version) throw new Error('Agent version not found or unauthorized.');

  // Unpublish existing published versions for this agent
  await db.agentVersion.updateMany({
    where: { agentId },
    data: { isPublished: false },
  });

  // Mark this version as published
  await db.agentVersion.update({
    where: { id: versionId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: actor.id,
    },
  });

  // Update agent active pointer
  await db.agent.update({
    where: { id: agentId },
    data: {
      currentVersionId: versionId,
      status: 'ACTIVE',
    },
  });

  await recordAuditLog({
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'TENANT_MEMBER',
    action: 'AGENT_VERSION_PUBLISHED',
    resource: 'agent',
    resourceId: agentId,
    changes: { versionNumber: version.versionNumber },
  });

  return version;
}

export async function rollbackAgentVersion(
  tenantId: string,
  agentId: string,
  targetVersionNumber: number,
  actor: { id: string; email: string }
) {
  const targetVersion = await db.agentVersion.findFirst({
    where: { agentId, versionNumber: targetVersionNumber, agent: { tenantId } },
  });

  if (!targetVersion) throw new Error(`Version v${targetVersionNumber} not found.`);

  return publishAgentVersion(tenantId, agentId, targetVersion.id, actor);
}

export async function setAgentStatus(
  tenantId: string,
  agentId: string,
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  actor: { id: string; email: string }
) {
  const updated = await db.agent.updateMany({
    where: { id: agentId, tenantId },
    data: { status },
  });

  await recordAuditLog({
    tenantId,
    actorId: actor.id,
    actorEmail: actor.email,
    actorType: 'TENANT_MEMBER',
    action: `AGENT_${status}`,
    resource: 'agent',
    resourceId: agentId,
  });

  return updated;
}
