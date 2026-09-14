import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { assertTenantAccess } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId);

    const documents = await db.knowledgeDocument.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { documents } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'UNAUTHORIZED', message: err.message } },
      { status: err.statusCode || 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ success: false, error: { message: 'Unauthorized' } }, { status: 401 });
    }
    assertTenantAccess(session, session.tenantId, ['OWNER', 'ADMIN', 'MANAGER']);

    const { title, type, content } = await req.json();

    const doc = await db.knowledgeDocument.create({
      data: {
        tenantId: session.tenantId,
        title,
        type: type || 'MARKDOWN',
        sizeBytes: (content?.length || 1024) * 2,
        status: 'READY',
        content,
        chunkCount: Math.ceil((content?.length || 500) / 400),
        lastIndexedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { document: doc } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: err.code || 'BAD_REQUEST', message: err.message } },
      { status: err.statusCode || 400 }
    );
  }
}
