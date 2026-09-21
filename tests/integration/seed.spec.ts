import { randomUUID } from "node:crypto";
import { ApplicationStatus, PrismaClient, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  permissionSeeds,
  seed,
  syntheticDocumentTypeSeeds,
  syntheticUserSeeds,
} from "../../packages/db/prisma/seed";

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
}

describe("synthetic seed lifecycle", () => {
  it("does not reactivate a disabled account when rerun", async () => {
    const prisma = new PrismaClient();
    const userId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: userId,
          googleSubject: `seed-regression-${userId}`,
          email: `${userId}@example.test`,
          status: UserStatus.DISABLED,
        },
      });
      await seed(prisma);

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.status).toBe(UserStatus.DISABLED);
    } finally {
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });

  it("loads synthetic users, permissions, an application, and document requirements", async () => {
    const prisma = new PrismaClient();

    try {
      await seed(prisma);

      const users = await prisma.user.findMany({
        where: {
          googleSubject: {
            in: syntheticUserSeeds.map(({ googleSubject }) => googleSubject),
          },
        },
        include: {
          roles: true,
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
        await prisma.permission.count({
          where: { code: { in: permissionSeeds.map(({ code }) => code) } },
        }),
      ).toBe(permissionSeeds.length);

      const participant = users.find(({ googleSubject }) => googleSubject === "seed-participant");
      if (participant === undefined) {
        throw new Error("Synthetic participant was not seeded.");
      }
      expect(participant.participantProfile?.application?.status).toBe(ApplicationStatus.DRAFT);
      expect(
        participant.participantProfile?.application?.documents.map(
          ({ documentType }) => documentType.code,
        ),
      ).toEqual(expect.arrayContaining(syntheticDocumentTypeSeeds.map(({ code }) => code)));
    } finally {
      await prisma.$disconnect();
    }
  });
});
