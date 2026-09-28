import type { PrismaClient, Tenant } from '../generated/prisma/client.js';

export interface CreateTenantInput {
  name: string;
  email: string;
  /** Present for self-signed-up tenants; omitted for admin-bootstrapped ones. */
  passwordHash?: string;
}

export class TenantsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateTenantInput): Promise<Tenant> {
    return this.prisma.tenant.create({ data: input });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { email } });
  }
}
