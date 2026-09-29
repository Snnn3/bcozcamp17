import { randomUUID } from "node:crypto";
import { PrismaClient, UserStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
}

describe("Supabase identity mapping constraints", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows at most one mapping for an auth UUID and an application user", async () => {
    const firstUser = await prisma.user.create({
      data: {
        googleSubject: `supabase-test-${randomUUID()}`,
        email: `supabase-test-${randomUUID()}@synthetic.example.test`,
        status: UserStatus.ACTIVE,
      },
    });
    const secondUser = await prisma.user.create({
      data: {
        googleSubject: `supabase-test-${randomUUID()}`,
        email: `supabase-test-${randomUUID()}@synthetic.example.test`,
        status: UserStatus.ACTIVE,
      },
    });
    const sharedSupabaseUserId = randomUUID();
    const sharedApplicationUserId = firstUser.id;
    const secondSupabaseUserId = randomUUID();

    try {
      const sameSupabaseId = await Promise.allSettled([
        prisma.supabaseAuthIdentityMapping.create({
          data: { supabaseUserId: sharedSupabaseUserId, userId: firstUser.id },
        }),
        prisma.supabaseAuthIdentityMapping.create({
          data: { supabaseUserId: sharedSupabaseUserId, userId: secondUser.id },
        }),
      ]);
      expect(sameSupabaseId.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(sameSupabaseId.filter(({ status }) => status === "rejected")).toHaveLength(1);

      await prisma.supabaseAuthIdentityMapping.deleteMany({
        where: { supabaseUserId: sharedSupabaseUserId },
      });
      const sameApplicationUser = await Promise.allSettled([
        prisma.supabaseAuthIdentityMapping.create({
          data: { supabaseUserId: sharedSupabaseUserId, userId: sharedApplicationUserId },
        }),
        prisma.supabaseAuthIdentityMapping.create({
          data: { supabaseUserId: secondSupabaseUserId, userId: sharedApplicationUserId },
        }),
      ]);
      expect(sameApplicationUser.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(sameApplicationUser.filter(({ status }) => status === "rejected")).toHaveLength(1);
    } finally {
      await prisma.supabaseAuthIdentityMapping.deleteMany({
        where: { supabaseUserId: { in: [sharedSupabaseUserId, secondSupabaseUserId] } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [firstUser.id, secondUser.id] } } });
    }
  });
});
