import { CampStatus, PrismaClient } from "@prisma/client";
import { basename, dirname } from "node:path";

export const permissionSeeds = [
  { code: "application_read", name: "Read applications" },
  { code: "document_read", name: "Read document versions" },
  { code: "document_review", name: "Review documents" },
  { code: "internal_note_read", name: "Read internal notes" },
  { code: "internal_note_write", name: "Write internal notes" },
  { code: "application_final_decision", name: "Make final application decisions" },
  { code: "export_applications", name: "Export applications" },
  { code: "configuration_manage", name: "Manage camp configuration" },
  { code: "permissions_manage", name: "Manage roles and permissions" },
] as const;

const rolePermissionSeeds = {
  participant: [],
  staff: [
    "application_read",
    "document_read",
    "document_review",
    "internal_note_read",
    "internal_note_write",
    "export_applications",
  ],
  admin: permissionSeeds.map(({ code }) => code),
} as const;

export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.campSettings.upsert({
    where: { singletonKey: 1 },
    update: {},
    create: {
      name: "BCOZ Camp 17",
      status: CampStatus.DRAFT,
      timezone: "Asia/Bangkok",
      capacity: 200,
      registrationOpensAt: new Date("2026-10-01T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-11-01T00:00:00.000Z"),
      startsAt: new Date("2026-12-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-07T00:00:00.000Z"),
      privacyNoticeVersion: "draft",
    },
  });

  for (const role of [
    { code: "participant", name: "Participant" },
    { code: "staff", name: "Staff" },
    { code: "admin", name: "Admin" },
  ]) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const permission of permissionSeeds) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name },
      create: permission,
    });
  }

  const roles = await prisma.role.findMany({
    where: { code: { in: Object.keys(rolePermissionSeeds) } },
    select: { id: true, code: true },
  });
  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionSeeds.map(({ code }) => code) } },
    select: { id: true, code: true },
  });
  const roleIds = new Map(roles.map((role) => [role.code, role.id]));
  const permissionIds = new Map(permissions.map((permission) => [permission.code, permission.id]));

  await prisma.rolePermission.createMany({
    data: Object.entries(rolePermissionSeeds).flatMap(([roleCode, permissionCodes]) => {
      const roleId = roleIds.get(roleCode);
      if (roleId === undefined) {
        throw new Error(`Seed role was not found: ${roleCode}`);
      }

      return permissionCodes.map((permissionCode) => {
        const permissionId = permissionIds.get(permissionCode);
        if (permissionId === undefined) {
          throw new Error(`Seed permission was not found: ${permissionCode}`);
        }

        return { roleId, permissionId };
      });
    }),
    skipDuplicates: true,
  });
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  basename(process.argv[1]) === "seed.ts" &&
  basename(dirname(process.argv[1])) === "prisma";

if (isDirectExecution) {
  const prisma = new PrismaClient();

  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
