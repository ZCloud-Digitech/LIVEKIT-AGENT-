import { db } from '@/lib/db';
import { getTenantEntitlement } from '@/services/entitlement.service';

export interface ConcurrencySlotResult {
  acquired: boolean;
  slotId?: string;
  activeCount: number;
  limit: number;
  error?: string;
}

/**
 * Call Concurrency Service
 * Database-level atomic concurrency enforcement.
 * Queries active calls directly from the database and prevents race conditions.
 */
export class ConcurrencyService {
  /**
   * Returns the count of currently active calls and reserved slots from the database.
   */
  async getActiveCallCount(tenantId: string): Promise<number> {
    const [callCount, reservedCount] = await Promise.all([
      db.call.count({
        where: {
          tenantId,
          status: { in: ['INITIATED', 'RINGING', 'IN_PROGRESS'] },
        },
      }),
      db.usageRecord.count({
        where: {
          tenantId,
          metricType: 'CONCURRENT_SLOT',
        },
      }),
    ]);
    return callCount + reservedCount;
  }

  /**
   * Atomically acquires a concurrent call slot via a database transaction.
   * Serializes requests using tenant-level row locking and atomically commits the slot.
   */
  async acquireSlot(tenantId: string, callId: string): Promise<ConcurrencySlotResult> {
    const entitlement = await getTenantEntitlement(tenantId);
    const limit = entitlement.maxConcurrentCalls || 1;

    try {
      const activeCount = await db.$transaction(async (tx) => {
        // 1. Database-level atomic lock: update tenant to serialize simultaneous requests
        await tx.tenant.update({
          where: { id: tenantId },
          data: { updatedAt: new Date() },
        });

        // 2. Count active calls and active reservations in the authoritative database
        const [activeCalls, activeReservations] = await Promise.all([
          tx.call.count({
            where: {
              tenantId,
              id: { not: callId },
              status: { in: ['INITIATED', 'RINGING', 'IN_PROGRESS'] },
            },
          }),
          tx.usageRecord.count({
            where: {
              tenantId,
              metricType: 'CONCURRENT_SLOT',
              slotKey: { not: `concurrency_${tenantId}_${callId}` },
            },
          }),
        ]);

        const totalActive = activeCalls + activeReservations;

        if (totalActive >= limit) {
          throw new Error(`CONCURRENCY_LIMIT_REACHED:${totalActive}:${limit}`);
        }

        // 3. Atomically persist slot claim inside the database transaction
        const existingCall = await tx.call.findUnique({ where: { id: callId } });
        if (existingCall) {
          await tx.call.update({
            where: { id: callId },
            data: { status: 'IN_PROGRESS' },
          });
        } else {
          const slotKey = `concurrency_${tenantId}_${callId}`;
          await tx.usageRecord.upsert({
            where: { slotKey },
            update: { timestamp: new Date() },
            create: {
              tenantId,
              metricType: 'CONCURRENT_SLOT',
              quantity: 1,
              slotKey,
              idempotencyKey: slotKey,
            },
          });
        }

        return totalActive;
      });

      const slotId = `slot_${tenantId}_${callId}_${Date.now()}`;
      return {
        acquired: true,
        slotId,
        activeCount: activeCount + 1,
        limit,
      };
    } catch (err: any) {
      if (err.message?.startsWith('CONCURRENCY_LIMIT_REACHED')) {
        const [, active, lim] = err.message.split(':');
        return {
          acquired: false,
          activeCount: parseInt(active, 10),
          limit: parseInt(lim, 10),
          error: `Tenant concurrent call limit (${lim}) reached. Active calls in progress: ${active}.`,
        };
      }
      return {
        acquired: false,
        activeCount: 0,
        limit,
        error: err.message || 'Database error during concurrency acquisition.',
      };
    }
  }

  /**
   * Releases an acquired slot at the database level by transitioning status and removing reservations.
   */
  async releaseSlot(callId: string, finalStatus: string = 'COMPLETED'): Promise<void> {
    try {
      await db.call.updateMany({
        where: { id: callId, status: { in: ['INITIATED', 'RINGING', 'IN_PROGRESS'] } },
        data: { status: finalStatus, endedAt: new Date() },
      });
      await db.usageRecord.deleteMany({
        where: {
          metricType: 'CONCURRENT_SLOT',
          OR: [
            { slotKey: { contains: callId } },
            { callId },
          ],
        },
      });
    } catch (err) {
      console.warn(`Failed to release call slot for call ${callId}:`, err);
    }
  }
}

export const concurrencyService = new ConcurrencyService();
