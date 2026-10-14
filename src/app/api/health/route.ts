import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Public Liveness & Readiness Health Check Endpoint
 * Used by container orchestrators, load balancers, and Docker healthchecks.
 */
export async function GET() {
  const start = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch (err: any) {
    dbStatus = 'unhealthy';
    console.error('Health check database query failed:', err.message);
  }

  const isHealthy = dbStatus === 'healthy';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      latencyMs: dbLatencyMs,
      services: {
        database: dbStatus,
        controlPlane: 'online',
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
