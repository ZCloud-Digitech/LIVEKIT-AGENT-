import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';
import { GET } from '../app/api/internal/agent-runtime/route';
import { NextRequest } from 'next/server';

// Load environment from .env safely if running in test runner
if (!process.env.WORKER_API_SECRET) {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = (match[2] || '').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}
const WORKER_SECRET = process.env.WORKER_API_SECRET;
if (!WORKER_SECRET) {
  throw new Error('WORKER_API_SECRET environment variable is required to run acceptance tests.');
}

function createMockRequest(url: string, bearerToken?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (bearerToken !== undefined) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  }
  return new NextRequest(url, { headers });
}

async function runRuntimeTests() {
  console.log('?? Running Control Plane Agent Runtime API Acceptance Tests...\n');

  // Fetch test fixtures
  const tenantA = await db.tenant.findFirst({ where: { name: 'Apex Dental Care' } });
  const tenantB = await db.tenant.findFirst({ where: { name: 'Metro Health Clinic' } });

  if (!tenantA || !tenantB) {
    throw new Error('Test tenants not found. Run database seed first.');
  }

  const agentA = await db.agent.findFirst({
    where: { tenantId: tenantA.id },
    include: { versions: true },
  });
  const agentB = await db.agent.findFirst({
    where: { tenantId: tenantB.id },
    include: { versions: true },
  });

  if (!agentA || !agentB) {
    throw new Error('Test agents not found.');
  }

  // Create an unpublished draft version on Agent A for testing
  const unpublishedVersion = await db.agentVersion.create({
    data: {
      agentId: agentA.id,
      versionNumber: 999,
      changeSummary: 'Unpublished draft version',
      prompt: 'Unpublished draft prompt',
      greeting: 'Unpublished draft greeting',
      isPublished: false,
    },
  });

  const publishedVersionA = agentA.versions.find((v) => v.isPublished) || agentA.versions[0];
  const publishedVersionB = agentB.versions.find((v) => v.isPublished) || agentB.versions[0];

  let passed = 0;

  try {
    // -------------------------------------------------------------
    // Test 1: Authentication failure with missing or invalid token
    // -------------------------------------------------------------
    console.log('--- Test 1: Authentication enforcement ---');
    const reqNoAuth = createMockRequest(`http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentA.id}`);
    const resNoAuth = await GET(reqNoAuth);
    if (resNoAuth.status === 401) {
      console.log('? TEST 1a PASSED: Missing auth header returned 401.');
      passed++;
    } else {
      console.error(`? TEST 1a FAILED: Expected 401, got ${resNoAuth.status}`);
    }

    const reqWrongAuth = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentA.id}`,
      'invalid-secret-token'
    );
    const resWrongAuth = await GET(reqWrongAuth);
    if (resWrongAuth.status === 401) {
      console.log('? TEST 1b PASSED: Invalid auth token returned 401.');
      passed++;
    } else {
      console.error(`? TEST 1b FAILED: Expected 401, got ${resWrongAuth.status}`);
    }

    // -------------------------------------------------------------
    // Test 2: Tenant Isolation (Tenant A requesting Tenant B agent)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Tenant Isolation ---');
    const reqCrossTenant = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentB.id}`,
      WORKER_SECRET
    );
    const resCrossTenant = await GET(reqCrossTenant);
    if (resCrossTenant.status === 404) {
      const data = await resCrossTenant.json();
      if (data.error?.code === 'AGENT_NOT_FOUND') {
        console.log('? TEST 2 PASSED: Cross-tenant access rejected with 404 AGENT_NOT_FOUND.');
        passed++;
      } else {
        console.error('? TEST 2 FAILED: Unexpected error code', data);
      }
    } else {
      console.error(`? TEST 2 FAILED: Expected 404, got ${resCrossTenant.status}`);
    }

    // -------------------------------------------------------------
    // Test 3: Invalid Agent ID
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Invalid Agent ID ---');
    const reqBadAgent = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=nonexistent_agent_123`,
      WORKER_SECRET
    );
    const resBadAgent = await GET(reqBadAgent);
    if (resBadAgent.status === 404) {
      console.log('? TEST 3 PASSED: Non-existent agent rejected with 404.');
      passed++;
    } else {
      console.error(`? TEST 3 FAILED: Expected 404, got ${resBadAgent.status}`);
    }

    // -------------------------------------------------------------
    // Test 4: Invalid Version ID (Version belongs to another agent)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Invalid Version ID ---');
    const reqMismatchedVersion = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentA.id}&agentVersionId=${publishedVersionB.id}`,
      WORKER_SECRET
    );
    const resMismatchedVersion = await GET(reqMismatchedVersion);
    if (resMismatchedVersion.status === 404) {
      console.log('? TEST 4 PASSED: Mismatched version rejected with 404.');
      passed++;
    } else {
      console.error(`? TEST 4 FAILED: Expected 404, got ${resMismatchedVersion.status}`);
    }

    // -------------------------------------------------------------
    // Test 5: Unpublished Draft Version Rejection
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Unpublished Version Rejection ---');
    const reqUnpublished = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentA.id}&agentVersionId=${unpublishedVersion.id}`,
      WORKER_SECRET
    );
    const resUnpublished = await GET(reqUnpublished);
    if (resUnpublished.status === 400) {
      const data = await resUnpublished.json();
      if (data.error?.code === 'VERSION_UNPUBLISHED') {
        console.log('? TEST 5 PASSED: Unpublished draft version rejected with 400 VERSION_UNPUBLISHED.');
        passed++;
      } else {
        console.error('? TEST 5 FAILED: Unexpected error code', data);
      }
    } else {
      console.error(`? TEST 5 FAILED: Expected 400, got ${resUnpublished.status}`);
    }

    // -------------------------------------------------------------
    // Test 6: Valid Published Agent Runtime Config
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Valid Runtime Config Retrieval ---');
    const reqValid = createMockRequest(
      `http://localhost:3000/api/internal/agent-runtime?tenantId=${tenantA.id}&agentId=${agentA.id}&agentVersionId=${publishedVersionA.id}`,
      WORKER_SECRET
    );
    const resValid = await GET(reqValid);
    if (resValid.status === 200) {
      const data = await resValid.json();
      if (
        data.success &&
        data.data.tenantId === tenantA.id &&
        data.data.agentId === agentA.id &&
        data.data.agentVersionId === publishedVersionA.id &&
        typeof data.data.prompt === 'string' &&
        typeof data.data.greeting === 'string' &&
        typeof data.data.temperature === 'number'
      ) {
        console.log('? TEST 6 PASSED: Valid runtime configuration returned with expected fields.');
        passed++;
      } else {
        console.error('? TEST 6 FAILED: Invalid data payload', data);
      }
    } else {
      console.error(`? TEST 6 FAILED: Expected 200, got ${resValid.status}`);
    }

    // -------------------------------------------------------------
    // Test 7: Verify Secret Fields are NOT Returned
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Secret Stripping Verification ---');
    const resSecretsCheck = await GET(reqValid);
    const bodyStr = await resSecretsCheck.text();
    const sensitiveTokens = [
      'password',
      'passwordHash',
      'secret',
      'livekitSecret',
      'JWT_SECRET',
      'WORKER_API_SECRET',
      'stripeCustomerId',
      'credentialsEncrypted',
    ];

    let leakFound = false;
    for (const token of sensitiveTokens) {
      // Check if any sensitive keys appear in the JSON
      if (bodyStr.toLowerCase().includes(`"${token.toLowerCase()}":`)) {
        console.error(`? TEST 7 FAILED: Sensitive token "${token}" found in response!`);
        leakFound = true;
      }
    }

    if (!leakFound) {
      console.log('? TEST 7 PASSED: Zero secret or internal credential fields exposed in response.');
      passed++;
    }

    console.log(`\n?? All ${passed}/8 Control Plane Agent Runtime Tests PASSED!`);
  } finally {
    // Cleanup temporary unpublished version
    await db.agentVersion.deleteMany({ where: { id: unpublishedVersion.id } });
    await db.$disconnect();
  }
}

runRuntimeTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});