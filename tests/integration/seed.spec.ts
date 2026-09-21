import { ApplicationStatus, Prisma, PrismaClient, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertSyntheticSeedAllowed,
  permissionSeeds,
  rolePermissionSeeds,
  seedDatabase,
  syntheticDocumentTypeSeeds,
  syntheticUserSeeds,
} from "../../packages/db/prisma/seed";

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
}

const syntheticSeedOptions = { mode: "synthetic", nodeEnv: "test" } as const;

class RollbackSeedTransaction extends Error {}

async function runSeedFixture(
  prisma: PrismaClient,
  prepare: (transaction: Prisma.TransactionClient) => Promise<void>,
  assertFixture: (transaction: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  const rollback = new RollbackSeedTransaction();

  try {
    await prisma.$transaction(async (transaction) => {
      await prepare(transaction);
      await seedDatabase(transaction, syntheticSeedOptions);
      await assertFixture(transaction);
      throw rollback;
    });
  } catch (error: unknown) {
    if (error === rollback) {
      return;
    }

    throw error;
  }

  throw new Error("Seed fixture transaction unexpectedly committed.");
}

describe("synthetic seed safety", () => {
  it("requires synthetic mode outside production", () => {
    expect(() => assertSyntheticSeedAllowed({ mode: undefined, nodeEnv: "development" })).toThrow(
      "BCOZ_SEED_MODE=synthetic",
    );
    expect(() => assertSyntheticSeedAllowed({ mode: "synthetic", nodeEnv: "production" })).toThrow(
      "NODE_ENV is development or test",
    );
  });
});

describe("synthetic seed lifecycle", () => {
  it("does not reactivate a declared synthetic account when rerun", async () => {
    const prisma = new PrismaClient();
    const disabledSeed = syntheticUserSeeds[0];
    const previousUser = await prisma.user.findUnique({
      where: { googleSubject: disabledSeed.googleSubject },
    });

    try {
      await runSeedFixture(
        prisma,
        async (transaction) => {
          await transaction.user.upsert({
            where: { googleSubject: disabledSeed.googleSubject },
            update: { status: UserStatus.DISABLED },
            create: {
              googleSubject: disabledSeed.googleSubject,
              email: disabledSeed.email,
              status: UserStatus.DISABLED,
            },
          });
        },
        async (transaction) => {
          const user = await transaction.user.findUniqueOrThrow({
            where: { googleSubject: disabledSeed.googleSubject },
          });
          expect(user.status).toBe(UserStatus.DISABLED);
        },
      );
      const restoredUser = await prisma.user.findUnique({
        where: { googleSubject: disabledSeed.googleSubject },
      });
      expect(restoredUser?.status).toBe(previousUser?.status);
      expect(restoredUser?.email).toBe(previousUser?.email);
    } finally {
      await prisma.$disconnect();
    }
  });

  it("loads synthetic users, roles, permissions, an application, and document requirements", async () => {
    const prisma = new PrismaClient();

    try {
      await runSeedFixture(
        prisma,
        async () => {},
        async (transaction) => {
          const users = await transaction.user.findMany({
            where: {
              googleSubject: {
                in: syntheticUserSeeds.map(({ googleSubject }) => googleSubject),
              },
            },
            include: {
              roles: { include: { role: true } },
              participantProfile: {
                include: {
                  application: {
                    include: {
                      documents: {
                        include: { documentType: true },
                      },
                    },
                  },
                },
              },
            },
          });
          expect(users).toHaveLength(syntheticUserSeeds.length);
          expect(users.every(({ email }) => email.endsWith("@synthetic.example.test"))).toBe(true);
          expect(
            await transaction.permission.count({
              where: { code: { in: permissionSeeds.map(({ code }) => code) } },
            }),
          ).toBe(permissionSeeds.length);

          for (const userSeed of syntheticUserSeeds) {
            const user = users.find(
              ({ googleSubject }) => googleSubject === userSeed.googleSubject,
            );
            if (user === undefined) {
              throw new Error(`Synthetic user was not seeded: ${userSeed.googleSubject}`);
            }

            expect(user.roles.map(({ role }) => role.code)).toEqual([userSeed.roleCode]);
          }

          const rolePermissions = await transaction.rolePermission.findMany({
            where: { role: { code: { in: Object.keys(rolePermissionSeeds) } } },
            select: {
              role: { select: { code: true } },
              permission: { select: { code: true } },
            },
          });
          for (const [roleCode, expectedPermissions] of Object.entries(rolePermissionSeeds)) {
            expect(
              rolePermissions
                .filter(({ role }) => role.code === roleCode)
                .map(({ permission }) => permission.code)
                .sort(),
            ).toEqual([...expectedPermissions].sort());
          }

          const participant = users.find(
            ({ googleSubject }) => googleSubject === "seed-participant",
          );
          if (participant === undefined) {
            throw new Error("Synthetic participant was not seeded.");
          }
          expect(participant.participantProfile?.application?.status).toBe(ApplicationStatus.DRAFT);
          expect(
            participant.participantProfile?.application?.documents.map(
              ({ documentType }) => documentType.code,
            ),
          ).toEqual(expect.arrayContaining(syntheticDocumentTypeSeeds.map(({ code }) => code)));
        },
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
