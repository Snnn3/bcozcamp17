import {
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey as NodeJsonWebKey,
} from "node:crypto";
import type { FastifyInstance } from "fastify";
import { DependencyUnavailableError, createSuccessResponse } from "@bcoz/api";
import { effectivePermissionCodes, type AuthenticatedPrincipal } from "@bcoz/auth";
import type { PrismaClient } from "@bcoz/db";
import type { UserDirectory } from "./auth.js";
import { sendApiError } from "./auth.js";

const SUPABASE_AUTH_AUDIENCE = "authenticated";
const SUPABASE_AUTH_ROLE = "authenticated";
const JWKS_CACHE_MS = 5 * 60 * 1_000;
const JWKS_REFRESH_COOLDOWN_MS = 10_000;
const MAX_ACCESS_TOKEN_LENGTH = 16_384;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SupabaseRsaJwk {
  kty: "RSA";
  kid: string;
  n: string;
  e: string;
  alg?: "RS256";
  use?: "sig";
  key_ops?: string[];
}

interface CachedJwks {
  keys: SupabaseRsaJwk[];
  expiresAt: number;
}

export interface SupabaseAccessTokenVerifierOptions {
  supabaseUrl: string;
  now?: () => number;
  fetcher?: typeof fetch;
}

export interface VerifiedSupabaseAccessToken {
  subject: string;
}

export interface SupabaseAccessTokenVerifierPort {
  verify(accessToken: string): Promise<VerifiedSupabaseAccessToken>;
}

export class InvalidSupabaseAccessTokenError extends Error {
  public constructor() {
    super("Supabase access token was not accepted.");
    this.name = "InvalidSupabaseAccessTokenError";
  }
}

export class SupabaseVerifierUnavailableError extends Error {
  public constructor() {
    super("Supabase signing keys are temporarily unavailable.");
    this.name = "SupabaseVerifierUnavailableError";
  }
}

export class SupabaseAccessTokenVerifier implements SupabaseAccessTokenVerifierPort {
  private readonly issuer: string;
  private readonly jwksUrl: URL;
  private readonly now: () => number;
  private readonly fetcher: typeof fetch;
  private cachedJwks: CachedJwks | undefined;
  private jwksRefreshInFlight: Promise<CachedJwks> | undefined;
  private lastJwksRefreshAttemptAt = 0;

  public constructor(options: SupabaseAccessTokenVerifierOptions) {
    const projectUrl = parseProjectUrl(options.supabaseUrl);
    this.issuer = `${projectUrl.origin}/auth/v1`;
    this.jwksUrl = new URL("/auth/v1/.well-known/jwks.json", projectUrl.origin);
    this.now = options.now ?? (() => Date.now());
    this.fetcher = options.fetcher ?? fetch;
  }

  public async verify(accessToken: string): Promise<VerifiedSupabaseAccessToken> {
    if (accessToken.length === 0 || accessToken.length > MAX_ACCESS_TOKEN_LENGTH) {
      throw new InvalidSupabaseAccessTokenError();
    }

    const parts = accessToken.split(".");
    if (parts.length !== 3) {
      throw new InvalidSupabaseAccessTokenError();
    }
    const [encodedHeader, encodedClaims, encodedSignature] = parts;
    if (
      encodedHeader === undefined ||
      encodedClaims === undefined ||
      encodedSignature === undefined
    ) {
      throw new InvalidSupabaseAccessTokenError();
    }

    const header = parseJwtJson(encodedHeader);
    const claims = parseJwtJson(encodedClaims);
    const keyId = readNonEmptyString(header, "kid");
    if (
      header.alg !== "RS256" ||
      keyId === undefined ||
      !hasValidClaims(claims, this.issuer, this.now())
    ) {
      throw new InvalidSupabaseAccessTokenError();
    }

    const key = await this.findSigningKey(keyId);
    if (key === null) {
      throw new InvalidSupabaseAccessTokenError();
    }

    try {
      const publicJwk: NodeJsonWebKey = {
        kty: key.kty,
        kid: key.kid,
        n: key.n,
        e: key.e,
        ...(key.alg === undefined ? {} : { alg: key.alg }),
        ...(key.use === undefined ? {} : { use: key.use }),
        ...(key.key_ops === undefined ? {} : { key_ops: key.key_ops }),
      };
      const publicKey = createPublicKey({ key: publicJwk, format: "jwk" });
      const validSignature = verifySignature(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedClaims}`),
        publicKey,
        decodeBase64Url(encodedSignature),
      );
      if (!validSignature) {
        throw new InvalidSupabaseAccessTokenError();
      }
    } catch (error: unknown) {
      if (error instanceof InvalidSupabaseAccessTokenError) {
        throw error;
      }
      throw new InvalidSupabaseAccessTokenError();
    }

    const subject = readNonEmptyString(claims, "sub");
    if (subject === undefined) {
      throw new InvalidSupabaseAccessTokenError();
    }
    return { subject };
  }

  private async findSigningKey(keyId: string): Promise<SupabaseRsaJwk | null> {
    const cached = this.cachedJwks;
    const now = this.now();
    if (cached !== undefined && cached.expiresAt > this.now()) {
      const cachedKey = cached.keys.find((key) => key.kid === keyId);
      if (cachedKey !== undefined) {
        return cachedKey;
      }
    }

    if (this.jwksRefreshInFlight !== undefined) {
      const jwks = await this.jwksRefreshInFlight;
      return jwks.keys.find((key) => key.kid === keyId) ?? null;
    }

    if (
      this.lastJwksRefreshAttemptAt > 0 &&
      now - this.lastJwksRefreshAttemptAt < JWKS_REFRESH_COOLDOWN_MS
    ) {
      if (cached !== undefined && cached.expiresAt > now) {
        return null;
      }
      throw new SupabaseVerifierUnavailableError();
    }

    this.lastJwksRefreshAttemptAt = now;
    const refresh = this.fetchJwks();
    this.jwksRefreshInFlight = refresh;
    try {
      const jwks = await refresh;
      return jwks.keys.find((candidate) => candidate.kid === keyId) ?? null;
    } finally {
      if (this.jwksRefreshInFlight === refresh) {
        this.jwksRefreshInFlight = undefined;
      }
    }
  }

  private async fetchJwks(): Promise<CachedJwks> {
    let response: Response;
    try {
      response = await this.fetcher(this.jwksUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new SupabaseVerifierUnavailableError();
    }
    if (!response.ok) {
      throw new SupabaseVerifierUnavailableError();
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SupabaseVerifierUnavailableError();
    }
    if (!isRecord(payload) || !Array.isArray(payload.keys)) {
      throw new SupabaseVerifierUnavailableError();
    }

    const keys = payload.keys.filter(isSupabaseRsaJwk);
    if (keys.length === 0) {
      throw new SupabaseVerifierUnavailableError();
    }
    const maxAgeSeconds = readJwksMaxAge(response.headers.get("cache-control"));
    const cachedJwks = {
      keys,
      expiresAt: this.now() + Math.min(maxAgeSeconds * 1_000, 60 * 60 * 1_000),
    } satisfies CachedJwks;
    this.cachedJwks = cachedJwks;
    return cachedJwks;
  }
}

export interface SupabaseAuthIdentityDirectory {
  resolveApplicationUserId(supabaseUserId: string): Promise<string | null>;
}

export class PrismaSupabaseAuthIdentityDirectory implements SupabaseAuthIdentityDirectory {
  public constructor(private readonly prisma: PrismaClient) {}

  public async resolveApplicationUserId(supabaseUserId: string): Promise<string | null> {
    const mapping = await this.prisma.supabaseAuthIdentityMapping.findUnique({
      where: { supabaseUserId },
      select: { userId: true },
    });
    return mapping?.userId ?? null;
  }
}

export interface SupabaseBearerAuthenticationDependencies {
  tokenVerifier: SupabaseAccessTokenVerifierPort;
  identityDirectory: SupabaseAuthIdentityDirectory;
  userDirectory: UserDirectory;
}

export async function resolveSupabaseBearerPrincipal(
  authorizationHeader: string | undefined,
  dependencies: SupabaseBearerAuthenticationDependencies,
): Promise<AuthenticatedPrincipal | null> {
  const accessToken = readBearerToken(authorizationHeader);
  if (accessToken === undefined) {
    return null;
  }

  let verifiedIdentity: VerifiedSupabaseAccessToken;
  try {
    verifiedIdentity = await dependencies.tokenVerifier.verify(accessToken);
  } catch (error: unknown) {
    if (error instanceof InvalidSupabaseAccessTokenError) {
      return null;
    }
    throw error;
  }

  const applicationUserId = await dependencies.identityDirectory.resolveApplicationUserId(
    verifiedIdentity.subject,
  );
  if (applicationUserId === null) {
    return null;
  }

  const principal = await dependencies.userDirectory.getPrincipal(applicationUserId);
  return principal?.status === "active" ? principal : null;
}

export function registerSupabaseIdentityRoute(
  server: FastifyInstance,
  dependencies: SupabaseBearerAuthenticationDependencies,
): void {
  server.get("/api/v1/auth/supabase/session", async (request, reply) => {
    let principal: AuthenticatedPrincipal | null;
    try {
      principal = await resolveSupabaseBearerPrincipal(request.headers.authorization, dependencies);
    } catch (error: unknown) {
      if (error instanceof InvalidSupabaseAccessTokenError) {
        principal = null;
      } else {
        request.log.warn("Supabase bearer authentication dependency unavailable");
        if (error instanceof SupabaseVerifierUnavailableError) {
          return sendApiError(
            reply,
            503,
            "DEPENDENCY_UNAVAILABLE",
            "A required service is temporarily unavailable.",
          );
        }
        throw new DependencyUnavailableError();
      }
    }

    if (principal === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }

    reply.header("cache-control", "no-store");
    return reply.send(
      createSuccessResponse({
        userId: principal.userId,
        email: principal.email,
        roles: principal.roles,
        permissions: effectivePermissionCodes(principal),
      }),
    );
  });
}

function parseProjectUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("SUPABASE_URL must be a valid project URL.");
  }
  const localHttpAllowed =
    url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttpAllowed) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("SUPABASE_URL must be an HTTPS project origin (or local HTTP origin).");
  }
  return url;
}

function hasValidClaims(claims: Record<string, unknown>, issuer: string, now: number): boolean {
  const subject = readNonEmptyString(claims, "sub");
  const audience = claims.aud;
  const hasExpectedAudience =
    audience === SUPABASE_AUTH_AUDIENCE ||
    (Array.isArray(audience) && audience.includes(SUPABASE_AUTH_AUDIENCE));
  return (
    claims.iss === issuer &&
    hasExpectedAudience &&
    claims.role === SUPABASE_AUTH_ROLE &&
    subject !== undefined &&
    UUID_PATTERN.test(subject) &&
    typeof claims.exp === "number" &&
    Number.isFinite(claims.exp) &&
    claims.exp > Math.floor(now / 1_000) &&
    (claims.nbf === undefined ||
      (typeof claims.nbf === "number" && Number.isFinite(claims.nbf) && claims.nbf <= now / 1_000))
  );
}

function parseJwtJson(segment: string): Record<string, unknown> {
  try {
    const decoded = decodeBase64Url(segment).toString("utf8");
    const parsed: unknown = JSON.parse(decoded);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new InvalidSupabaseAccessTokenError();
  }
  return Buffer.from(value, "base64url");
}

function readNonEmptyString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupabaseRsaJwk(value: unknown): value is SupabaseRsaJwk {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.kty === "RSA" &&
    typeof value.kid === "string" &&
    value.kid !== "" &&
    typeof value.n === "string" &&
    typeof value.e === "string" &&
    (value.alg === undefined || value.alg === "RS256") &&
    (value.use === undefined || value.use === "sig") &&
    (value.key_ops === undefined ||
      (Array.isArray(value.key_ops) && value.key_ops.includes("verify")))
  );
}

function readJwksMaxAge(cacheControl: string | null): number {
  const match = cacheControl?.match(/(?:^|,\s*)max-age=(\d+)/i);
  const value = match?.[1];
  if (value === undefined) {
    return JWKS_CACHE_MS / 1_000;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : JWKS_CACHE_MS / 1_000;
}

function readBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (
    authorizationHeader === undefined ||
    authorizationHeader.length > MAX_ACCESS_TOKEN_LENGTH + 16
  ) {
    return undefined;
  }
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorizationHeader);
  return match?.[1];
}
