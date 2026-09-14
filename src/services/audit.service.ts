import { db } from '@/lib/db';

export interface RecordAuditParams {
  tenantId?: string | null;
  actorId: string;
  actorEmail: string;
  actorType: 'PLATFORM_USER' | 'TENANT_MEMBER';
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(params: RecordAuditParams) {
  try {
    return await db.auditLog.create({
      data: {
        tenantId: params.tenantId || null,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        actorType: params.actorType,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId || null,
        changes: params.changes ? JSON.stringify(params.changes) : '{}',
        ipAddress: params.ipAddress || '127.0.0.1',
        userAgent: params.userAgent || 'WebBrowser',
      },
    });
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error);
    // Never crash primary flow due to logging
    return null;
  }
}

export async function listAuditLogs(tenantId?: string, limit = 50) {
  return db.auditLog.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
