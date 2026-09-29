import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaLoginRateLimiter } from "../../apps/server/src/auth";

if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL.trim() === "") {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
}

const WINDOW_MS = 60_000;

function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

describe("durable login rate limiting", () => {
  const prisma = new PrismaClient();
  const limiter = new PrismaLoginRateLimiter(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts concurrent requests atomically against one shared bucket", async () => {
    const key = `integration:${randomUUID()}`;
    const requestCount = 32;
    const maximumRequests = 11;
    const now = Date.now();

    try {
      const results = await Promise.all(
        Array.from({ length: requestCount }, () =>
          limiter.consume(key, now, maximumRequests, WINDOW_MS),
        ),
      );
      const bucket = await prisma.loginRateLimitBucket.findUnique({
        where: { key: hashRateLimitKey(key) },
      });

      expect(results.filter(({ allowed }) => allowed)).toHaveLength(maximumRequests);
      expect(results.filter(({ allowed }) => !allowed)).toHaveLength(
        requestCount - maximumRequests,
      );
      expect(bucket?.requestCount).toBe(requestCount);
    } finally {
      await prisma.loginRateLimitBucket.deleteMany({
        where: { key: hashRateLimitKey(key) },
      });
    }
  });

  it("removes buckets from earlier windows as new-window traffic arrives", async () => {
    const expiredKey = `integration-expired:${randomUUID()}`;
    const activeKey = `integration-active:${randomUUID()}`;
    const activeWindowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
    const expiredWindowStart = activeWindowStart - WINDOW_MS;
    const expiredHash = hashRateLimitKey(expiredKey);
    const activeHash = hashRateLimitKey(activeKey);

    try {
      await limiter.consume(expiredKey, expiredWindowStart, 10, WINDOW_MS);
      expect(
        await prisma.loginRateLimitBucket.findUnique({ where: { key: expiredHash } }),
      ).not.toBeNull();

      await limiter.consume(activeKey, activeWindowStart + 1, 10, WINDOW_MS);

      expect(
        await prisma.loginRateLimitBucket.findUnique({ where: { key: expiredHash } }),
      ).toBeNull();
      expect(
        await prisma.loginRateLimitBucket.findUnique({ where: { key: activeHash } }),
      ).not.toBeNull();
    } finally {
      await prisma.loginRateLimitBucket.deleteMany({
        where: { key: { in: [expiredHash, activeHash] } },
      });
    }
  });
});
