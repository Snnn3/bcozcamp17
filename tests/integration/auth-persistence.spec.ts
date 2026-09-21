import { randomUUID } from "node:crypto";
import { PrismaClient, UserStatus } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaSessionStore, PrismaUserDirectory } from "../../apps/server/src/auth";

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
}

describe("durable authentication persistence", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("loads current roles and status for an existing session", async () => {
    const subject = `auth-persistence-${randomUUID()}`;
    const email = `${subject}@example.test`;
    const directory = new PrismaUserDirectory(prisma);

    try {
      await prisma.role.upsert({
        where: { code: "participant" },
        update: {},
        create: { code: "participant", name: "Participant" },
      });
      const staffRole = await prisma.role.upsert({
        where: { code: "staff" },
        update: {},
        create: { code: "staff", name: "Staff" },
      });
      const applicationRead = await prisma.permission.upsert({
        where: { code: "application_read" },
        update: {},
        create: { code: "application_read", name: "Read applications" },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: staffRole.id, permissionId: applicationRead.id },
        },
        update: {},
        create: { roleId: staffRole.id, permissionId: applicationRead.id },
      });

      const resolution = await directory.resolveGoogleIdentity({
        subject,
        email,
        emailVerified: true,
      });
      expect(resolution.kind).toBe("authenticated");
      if (resolution.kind !== "authenticated") {
        throw new Error("The synthetic identity was not provisioned.");
      }

      const sessionStore = new PrismaSessionStore(prisma, directory);
      const session = await sessionStore.create(resolution.principal, Date.now());
      await prisma.userRole.create({
        data: { userId: resolution.principal.userId, roleId: staffRole.id },
      });

      const withLiveRole = await sessionStore.get(session.sessionId, Date.now());
      expect(withLiveRole?.principal.roles).toContain("staff");
      expect(withLiveRole?.principal.permissions).toContainEqual({
        code: "application_read",
        effect: "allow",
      });

      await prisma.user.update({
        where: { id: resolution.principal.userId },
        data: { status: UserStatus.DISABLED },
      });
      await expect(sessionStore.get(session.sessionId, Date.now())).resolves.toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { googleSubject: subject } });
    }
  });

  it("rejects an email collision without merging identities", async () => {
    const directory = new PrismaUserDirectory(prisma);
    const firstSubject = `auth-collision-a-${randomUUID()}`;
    const secondSubject = `auth-collision-b-${randomUUID()}`;
    const email = `${firstSubject}@example.test`;

    try {
      const first = await directory.resolveGoogleIdentity({
        subject: firstSubject,
        email,
        emailVerified: true,
      });
      expect(first.kind).toBe("authenticated");
      await expect(
        directory.resolveGoogleIdentity({
          subject: secondSubject,
          email,
          emailVerified: true,
        }),
      ).resolves.toEqual({ kind: "email_collision" });
    } finally {
      await prisma.user.deleteMany({
        where: { googleSubject: { in: [firstSubject, secondSubject] } },
      });
    }
  });
});
