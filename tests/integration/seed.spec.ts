import { randomUUID } from "node:crypto";
import { PrismaClient, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seed } from "../../packages/db/prisma/seed";

const databaseTests = process.env.DATABASE_URL === undefined ? describe.skip : describe;

databaseTests("synthetic seed lifecycle", () => {
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
});
