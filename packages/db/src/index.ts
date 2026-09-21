export { PermissionEffect, Prisma, PrismaClient, UserStatus } from "@prisma/client";

import { PrismaClient } from "@prisma/client";

export function createDatabaseClient(databaseUrl?: string): PrismaClient {
  return databaseUrl === undefined
    ? new PrismaClient()
    : new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}
