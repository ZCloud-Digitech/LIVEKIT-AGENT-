import { db } from '@/lib/db';

export async function listCustomers(tenantId: string, search?: string) {
  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }
  return db.customer.findMany({
    where,
    include: {
      _count: { select: { appointments: true } },
    },
    orderBy: { lastContactedAt: 'desc' },
  });
}

export async function getCustomerById(tenantId: string, customerId: string) {
  return db.customer.findFirst({
    where: { id: customerId, tenantId },
    include: {
      appointments: {
        orderBy: { date: 'desc' },
      },
    },
  });
}

export async function createOrUpdateCustomer(tenantId: string, data: {
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  tags?: string[];
}) {
  const existing = await db.customer.findUnique({
    where: { tenantId_phone: { tenantId, phone: data.phone } },
  });

  if (existing) {
    return db.customer.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        email: data.email ?? existing.email,
        notes: data.notes ?? existing.notes,
        tags: data.tags ? JSON.stringify(data.tags) : existing.tags,
        lastContactedAt: new Date(),
      },
    });
  }

  return db.customer.create({
    data: {
      tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      notes: data.notes,
      tags: JSON.stringify(data.tags || []),
      lastContactedAt: new Date(),
    },
  });
}
