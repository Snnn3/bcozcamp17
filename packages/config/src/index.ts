import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value: unknown) => (value === "" ? undefined : value),
  z.string().url().optional(),
);
const storageEndpoint = optionalUrl.refine(
  (value) => value === undefined || ["http:", "https:"].includes(new URL(value).protocol),
  "STORAGE_ENDPOINT must use HTTP or HTTPS.",
);
const storageBucket = z
  .string()
  .trim()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/)
  .refine(
    (value) => !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value),
    "STORAGE_BUCKET must not look like an IP address.",
  );
const booleanFromEnvironment = z.preprocess((value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return value;
}, z.boolean().default(true));

const environmentInputSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  WEB_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  DATABASE_URL: optionalNonEmptyString,
  SESSION_SECRET: optionalNonEmptyString,
  STORAGE_ENDPOINT: storageEndpoint,
  STORAGE_REGION: z.string().min(1).default("us-east-1"),
  STORAGE_BUCKET: storageBucket.default("bcoz-private"),
  STORAGE_ACCESS_KEY_ID: optionalNonEmptyString,
  STORAGE_SECRET_ACCESS_KEY: optionalNonEmptyString,
  STORAGE_FORCE_PATH_STYLE: booleanFromEnvironment,
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_REDIRECT_URI: optionalUrl,
});

export const environmentSchema = environmentInputSchema.transform((input) => ({
  nodeEnv: input.NODE_ENV,
  port: input.PORT,
  webOrigins: input.WEB_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  databaseUrl: input.DATABASE_URL,
  sessionSecret: input.SESSION_SECRET,
  storageEndpoint: input.STORAGE_ENDPOINT,
  storageRegion: input.STORAGE_REGION,
  storageBucket: input.STORAGE_BUCKET,
  storageAccessKeyId: input.STORAGE_ACCESS_KEY_ID,
  storageSecretAccessKey: input.STORAGE_SECRET_ACCESS_KEY,
  storageForcePathStyle: input.STORAGE_FORCE_PATH_STYLE,
  googleClientId: input.GOOGLE_CLIENT_ID,
  googleClientSecret: input.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: input.GOOGLE_REDIRECT_URI,
}));

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironmentFile(filePath: string = resolve(process.cwd(), ".env")): void {
  if (existsSync(filePath)) {
    process.loadEnvFile(filePath);
  }
}

export function parseEnvironment(input: NodeJS.ProcessEnv = process.env): Environment {
  const environment = environmentSchema.parse(input);

  if (environment.webOrigins.length === 0) {
    throw new Error("WEB_ORIGINS must contain at least one allowed origin.");
  }

  const hasStorageAccessKey = environment.storageAccessKeyId !== undefined;
  const hasStorageSecretKey = environment.storageSecretAccessKey !== undefined;
  if (hasStorageAccessKey !== hasStorageSecretKey) {
    throw new Error(
      "STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY must be provided together.",
    );
  }

  if (environment.nodeEnv === "production") {
    if (
      environment.storageEndpoint !== undefined &&
      new URL(environment.storageEndpoint).protocol !== "https:"
    ) {
      throw new Error("Production STORAGE_ENDPOINT must use HTTPS.");
    }
    const missingProductionValues = [
      ["DATABASE_URL", environment.databaseUrl],
      ["SESSION_SECRET", environment.sessionSecret],
      ["STORAGE_ENDPOINT", environment.storageEndpoint],
      ["STORAGE_ACCESS_KEY_ID", environment.storageAccessKeyId],
      ["STORAGE_SECRET_ACCESS_KEY", environment.storageSecretAccessKey],
      ["GOOGLE_CLIENT_ID", environment.googleClientId],
      ["GOOGLE_CLIENT_SECRET", environment.googleClientSecret],
      ["GOOGLE_REDIRECT_URI", environment.googleRedirectUri],
    ].filter(([, value]) => value === undefined);

    if (missingProductionValues.length > 0) {
      const missingNames = missingProductionValues.map(([name]) => name).join(", ");
      throw new Error(`Missing required production environment variables: ${missingNames}`);
    }
  }

  return environment;
}

loadEnvironmentFile();

export const env = parseEnvironment();
