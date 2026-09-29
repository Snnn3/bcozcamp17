import { randomUUID } from "node:crypto";
import { PrismaClient, UserStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaUserDirectory } from "../../apps/server/src/auth";
import {
  PrismaSupabaseAuthIdentityDirectory,
  resolveSupabaseBearerPrincipal,
} from "../../apps/server/src/supabaseAuth";

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

  it("reloads live permissions and disabled status for a mapped identity", async () => {
    const targetUser = await prisma.user.create({
      data: {
        googleSubject: `supabase-test-${randomUUID()}`,
        email: `supabase-test-${randomUUID()}@synthetic.example.test`,
        status: UserStatus.ACTIVE,
      },
    });
    const grantorUser = await prisma.user.create({
      data: {
        googleSubject: `supabase-test-${randomUUID()}`,
        email: `supabase-test-${randomUUID()}@synthetic.example.test`,
        status: UserStatus.ACTIVE,
      },
    });
    const permission = await prisma.permission.create({
      data: {
        code: `supabase_test_${randomUUID().replaceAll("-", "")}`,
        name: "Supabase integration test permission",
      },
    });
    const supabaseUserId = randomUUID();

    try {
      await prisma.supabaseAuthIdentityMapping.create({
        data: { supabaseUserId, userId: targetUser.id },
      });
      await prisma.userPermission.create({
        data: {
          userId: targetUser.id,
          permissionId: permission.id,
          effect: "ALLOW",
          grantedBy: grantorUser.id,
        },
      });

      const dependencies = {
        tokenVerifier: { verify: async () => ({ subject: supabaseUserId }) },
        identityDirectory: new PrismaSupabaseAuthIdentityDirectory(prisma),
        userDirectory: new PrismaUserDirectory(prisma),
      };

      await expect(
        resolveSupabaseBearerPrincipal("Bearer synthetic", dependencies),
      ).resolves.toEqual(
        expect.objectContaining({
          userId: targetUser.id,
          permissions: [{ code: permission.code, effect: "allow" }],
        }),
      );

      await prisma.userPermission.update({
        where: {
          userId_permissionId: {
            userId: targetUser.id,
            permissionId: permission.id,
          },
        },
        data: { effect: "DENY" },
      });
      await expect(
        resolveSupabaseBearerPrincipal("Bearer synthetic", dependencies),
      ).resolves.toEqual(
        expect.objectContaining({
          userId: targetUser.id,
          permissions: [{ code: permission.code, effect: "deny" }],
        }),
      );

      await prisma.user.update({
        where: { id: targetUser.id },
        data: { status: UserStatus.DISABLED },
      });
      await expect(
        resolveSupabaseBearerPrincipal("Bearer synthetic", dependencies),
      ).resolves.toBeNull();
    } finally {
      await prisma.supabaseAuthIdentityMapping.deleteMany({ where: { supabaseUserId } });
      await prisma.userPermission.deleteMany({
        where: { userId: targetUser.id, permissionId: permission.id },
      });
      await prisma.permission.delete({ where: { id: permission.id } });
      await prisma.user.deleteMany({ where: { id: { in: [targetUser.id, grantorUser.id] } } });
    }
  });
});
