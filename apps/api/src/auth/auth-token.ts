import { createHmac, timingSafeEqual } from "node:crypto";
import { type JwtPayload } from "@wfp/shared";

function requireAuthSecret(): string {
  const secret = process.env.WFP_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "WFP_AUTH_SECRET environment variable is required. Refusing to start with an insecure default signing secret."
    );
  }
  return secret;
}

const AUTH_SECRET = requireAuthSecret();

const ACCESS_PREFIX = "wfp-access";
const REFRESH_PREFIX = "wfp-refresh";

type TokenKind = "access" | "refresh";

type SignedTokenPayload = JwtPayload & {
  kind: TokenKind;
  issuedAt: string;
};

export type VerifiedAuthToken = SignedTokenPayload;

function encodePayload(payload: SignedTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(raw: string) {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as SignedTokenPayload;
}

function signToken(prefix: string, payload: SignedTokenPayload) {
  const body = encodePayload(payload);
  const signature = createHmac("sha256", AUTH_SECRET).update(`${prefix}.${body}`).digest("base64url");
  return `${prefix}.${body}.${signature}`;
}

function verifySignature(prefix: string, rawPayload: string, signature: string) {
  const expected = createHmac("sha256", AUTH_SECRET).update(`${prefix}.${rawPayload}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createAccessToken(payload: JwtPayload) {
  return signToken(ACCESS_PREFIX, {
    ...payload,
    kind: "access",
    issuedAt: new Date().toISOString(),
  });
}

export function createRefreshToken(payload: JwtPayload) {
  return signToken(REFRESH_PREFIX, {
    ...payload,
    kind: "refresh",
    issuedAt: new Date().toISOString(),
  });
}

export function verifyAccessToken(token: string): VerifiedAuthToken | null {
  const [prefix, rawPayload, signature] = token.split(".");
  if (prefix !== ACCESS_PREFIX || !rawPayload || !signature) {
    return null;
  }

  if (!verifySignature(prefix, rawPayload, signature)) {
    return null;
  }

  const payload = decodePayload(rawPayload);
  if (payload.kind !== "access") {
    return null;
  }

  return {
    sub: payload.sub,
    role: payload.role,
    email: payload.email,
    tokenVersion: payload.tokenVersion,
    kind: payload.kind,
    issuedAt: payload.issuedAt,
  };
}
