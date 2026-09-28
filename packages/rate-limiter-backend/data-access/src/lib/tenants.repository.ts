import type { PrismaClient, Tenant } from '../generated/prisma/client.js';

export interface CreateTenantInput {
  name: string;
  email: string;
}

export class TenantsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateTenantInput): Promise<Tenant> {
    return this.prisma.tenant.create({ data: input });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }
}
