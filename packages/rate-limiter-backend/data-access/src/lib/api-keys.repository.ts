import { ApiKeyStatus } from '../generated/prisma/enums.js';
import type { ApiKey, PrismaClient } from '../generated/prisma/client.js';

export interface CreateApiKeyInput {
  tenantId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
}

export class ApiKeysRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: CreateApiKeyInput): Promise<ApiKey> {
    return this.prisma.apiKey.create({ data: input });
  }

  findActiveByHashedKey(hashedKey: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({
      where: { hashedKey, status: ApiKeyStatus.ACTIVE },
    });
  }

  findById(id: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  listForTenant(tenantId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  revoke(id: string): Promise<ApiKey> {
    return this.prisma.apiKey.update({
      where: { id },
      data: { status: ApiKeyStatus.REVOKED, revokedAt: new Date() },
    });
  }

  touchLastUsed(id: string): Promise<ApiKey> {
    return this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}
