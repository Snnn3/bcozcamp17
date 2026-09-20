import { CampStatus, PrismaClient, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function seed(): Promise<void> {
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

  await prisma.permission.createMany({
    data: [
      { code: "application_read", name: "Read applications" },
      { code: "document_review", name: "Review documents" },
      { code: "application_final_decision", name: "Make final application decisions" },
      { code: "export_applications", name: "Export applications" },
    ],
    skipDuplicates: true,
  });

  await prisma.user.updateMany({
    where: { status: { not: UserStatus.ACTIVE } },
    data: { status: UserStatus.ACTIVE },
  });
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
