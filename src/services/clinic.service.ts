import { db } from '@/lib/db';

export interface ClinicProfileData {
  clinicName: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  timezone?: string;
  website?: string | null;
  emergencyInstruction?: string | null;
}

export interface ClinicServiceData {
  name: string;
  description?: string | null;
  durationMinutes?: number;
  price?: number | null;
  active?: boolean;
}

export interface DaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

export type WeekSchedule = Record<string, DaySchedule>;

const DEFAULT_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  monday: { open: '08:00', close: '18:00', closed: false },
  tuesday: { open: '08:00', close: '18:00', closed: false },
  wednesday: { open: '08:00', close: '18:00', closed: false },
  thursday: { open: '08:00', close: '18:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false },
  sunday: { open: '00:00', close: '00:00', closed: true },
};

export class ClinicService {
  /**
   * Retrieves or creates default ClinicProfile for a tenant.
   */
  async getClinicProfile(tenantId: string) {
    let profile = await db.clinicProfile.findUnique({
      where: { tenantId },
    });

    if (!profile) {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }

      profile = await db.clinicProfile.create({
        data: {
          tenantId,
          clinicName: tenant.name || 'Healthcare Clinic',
          description: tenant.description || 'Comprehensive medical and healthcare services.',
          phone: tenant.phone || '+1 (555) 234-5678',
          email: tenant.email || 'info@clinic.com',
          address: tenant.address || '100 Medical Center Blvd',
          timezone: tenant.timezone || 'America/New_York',
          website: tenant.website || 'https://clinic.example.com',
          emergencyInstruction:
            'If this is a life-threatening medical emergency, please hang up immediately and call 911 or proceed to the nearest emergency room.',
        },
      });
    }

    return profile;
  }

  /**
   * Upserts the ClinicProfile for a tenant.
   */
  async upsertClinicProfile(tenantId: string, data: ClinicProfileData) {
    return db.clinicProfile.upsert({
      where: { tenantId },
      update: {
        clinicName: data.clinicName,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        timezone: data.timezone || 'America/New_York',
        website: data.website,
        emergencyInstruction: data.emergencyInstruction,
      },
      create: {
        tenantId,
        clinicName: data.clinicName,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        timezone: data.timezone || 'America/New_York',
        website: data.website,
        emergencyInstruction: data.emergencyInstruction,
      },
    });
  }

  /**
   * Lists clinic services for a tenant. Seeds defaults if none exist.
   */
  async listServices(tenantId: string, activeOnly: boolean = false) {
    const where: any = { tenantId };
    if (activeOnly) {
      where.active = true;
    }

    let services = await db.clinicService.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    if (services.length === 0 && !activeOnly) {
      const defaults = [
        { name: 'General Consultation', description: 'Comprehensive medical consultation & examination', durationMinutes: 30, price: 100 },
        { name: 'Dental Cleaning & Checkup', description: 'Routine teeth cleaning, hygiene, and exam', durationMinutes: 45, price: 150 },
        { name: 'Preventive Care', description: 'Annual physical and preventive screening', durationMinutes: 30, price: 120 },
        { name: 'Follow-up Visit', description: 'Post-treatment consultation and review', durationMinutes: 15, price: 60 },
      ];

      for (const d of defaults) {
        await db.clinicService.create({
          data: {
            tenantId,
            name: d.name,
            description: d.description,
            durationMinutes: d.durationMinutes,
            price: d.price,
            active: true,
          },
        });
      }

      services = await db.clinicService.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    }

    return services;
  }

  /**
   * Creates a new clinic service.
   */
  async createService(tenantId: string, data: ClinicServiceData) {
    return db.clinicService.create({
      data: {
        tenantId,
        name: data.name.trim(),
        description: data.description?.trim(),
        durationMinutes: data.durationMinutes || 30,
        price: data.price ?? 0,
        active: data.active ?? true,
      },
    });
  }

  /**
   * Updates an existing service.
   */
  async updateService(tenantId: string, serviceId: string, data: Partial<ClinicServiceData>) {
    return db.clinicService.update({
      where: { id: serviceId, tenantId },
      data: {
        name: data.name?.trim(),
        description: data.description?.trim(),
        durationMinutes: data.durationMinutes,
        price: data.price,
        active: data.active,
      },
    });
  }

  /**
   * Deletes a service safely. If referenced by existing appointments, archives (sets active: false).
   */
  async deleteService(tenantId: string, serviceId: string) {
    const appointmentCount = await db.appointment.count({
      where: { tenantId, serviceId },
    });

    if (appointmentCount > 0) {
      return db.clinicService.update({
        where: { id: serviceId, tenantId },
        data: { active: false },
      });
    }

    return db.clinicService.delete({
      where: { id: serviceId, tenantId },
    });
  }

  /**
   * Retrieves business hours for tenant. Seeds defaults if not yet configured.
   */
  async getBusinessHours(tenantId: string): Promise<WeekSchedule> {
    const hours = await db.businessHours.findMany({
      where: { tenantId },
    });

    if (hours.length === 0) {
      const created: WeekSchedule = {};
      for (const day of DEFAULT_DAYS) {
        const def = DEFAULT_WEEK_SCHEDULE[day];
        const record = await db.businessHours.create({
          data: {
            tenantId,
            dayOfWeek: day,
            openTime: def.open,
            closeTime: def.close,
            closed: def.closed,
          },
        });
        created[day] = {
          open: record.openTime,
          close: record.closeTime,
          closed: record.closed,
        };
      }
      return created;
    }

    const schedule: WeekSchedule = {};
    for (const h of hours) {
      schedule[h.dayOfWeek.toLowerCase()] = {
        open: h.openTime,
        close: h.closeTime,
        closed: h.closed,
      };
    }

    for (const day of DEFAULT_DAYS) {
      if (!schedule[day]) {
        schedule[day] = DEFAULT_WEEK_SCHEDULE[day];
      }
    }

    return schedule;
  }

  /**
   * Updates business hours for tenant.
   */
  async upsertBusinessHours(tenantId: string, schedule: WeekSchedule) {
    const results: any[] = [];
    for (const [day, val] of Object.entries(schedule)) {
      const dayLower = day.toLowerCase();
      const res = await db.businessHours.upsert({
        where: {
          tenantId_dayOfWeek: {
            tenantId,
            dayOfWeek: dayLower,
          },
        },
        update: {
          openTime: val.open,
          closeTime: val.close,
          closed: val.closed,
        },
        create: {
          tenantId,
          dayOfWeek: dayLower,
          openTime: val.open,
          closeTime: val.close,
          closed: val.closed,
        },
      });
      results.push(res);
    }
    return results;
  }
}

export const clinicService = new ClinicService();
