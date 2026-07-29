const encoder = new TextEncoder();
const decoder = new TextDecoder();

const DEFAULT_ALLOWED_ORIGINS = [
  "https://kimi-vault.com",
  "https://www.kimi-vault.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function normalizeOrigin(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\/+$/, "");
  if (!normalized) return "";
  try {
    return new URL(normalized).origin.toLowerCase();
  } catch {
    return normalized;
  }
}

const configuredOrigins = Deno.env.get("ALLOWED_ORIGINS")
  ?.split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS);
const blockedIps = new Set(
  (Deno.env.get("BLOCKED_IPS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

// Environment-level permanent wallet blocklist.
const blockedWallets = new Set(
  (Deno.env.get("BLOCKED_WALLETS") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^0x[a-fA-F0-9]{40}$/.test(value))
);

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

// Auto-block state: in-memory only, cleared on cold start.
type AutoBlockRecord = { until: number; reason: string };
const autoBlockedWallets = new Map<string, AutoBlockRecord>();
const walletStrikeBuckets = new Map<string, RateBucket>();

export interface AiSessionPayload {
  v: 1;
  wallet: string;
  origin: string;
  iat: number;
  exp: number;
}

export class SecurityError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SecurityError";
    this.status = status;
    this.code = code;
  }
}

export function getRequestOrigin(req: Request): string {
  return normalizeOrigin(req.headers.get("origin") || "");
}

export function isAllowedOrigin(req: Request): boolean {
  const origin = getRequestOrigin(req);
  return Boolean(origin) && allowedOrigins.has(origin);
}

export function assertAllowedOrigin(req: Request): string {
  const origin = getRequestOrigin(req);
  if (!origin || !allowedOrigins.has(origin)) {
    throw new SecurityError(403, "ORIGIN_FORBIDDEN", "当前来源不允许调用 AI 服务");
  }
  return origin;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = getRequestOrigin(req);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, x-client-info, authorization, content-type, x-kimi-ai-action, x-kimi-ai-session, x-kimi-captcha-token, x-kimi-captcha-answer",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      ...extraHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function securityErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof SecurityError) {
    return jsonResponse(req, { error: error.message, code: error.code }, error.status);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[ai-security] unexpected error", message);
  return jsonResponse(req, { error: "AI 安全校验暂时不可用", code: "SECURITY_UNAVAILABLE" }, 503);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function assertClientIpAllowed(req: Request): string {
  const clientIp = getClientIp(req);
  if (blockedIps.has(clientIp)) {
    throw new SecurityError(403, "IP_BLOCKED", "当前网络已被禁止调用 AI 服务");
  }
  return clientIp;
}

export function readPositiveInt(name: string, fallback: number, maximum = 10_000): number {
  const parsed = Number(Deno.env.get(name) || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), maximum);
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || now >= current.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    current.count += 1;
    if (current.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new SecurityError(429, "RATE_LIMITED", `请求过于频繁，请在 ${retryAfter} 秒后重试`);
    }
  }

  if (rateBuckets.size > 5_000) {
    for (const [bucketKey, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) rateBuckets.delete(bucketKey);
    }
  }
}

export async function readJsonBody<T>(req: Request, maxBytes: number): Promise<T> {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > maxBytes) {
    throw new SecurityError(413, "REQUEST_TOO_LARGE", "请求内容过大");
  }
  const raw = await req.text();
  if (encoder.encode(raw).byteLength > maxBytes) {
    throw new SecurityError(413, "REQUEST_TOO_LARGE", "请求内容过大");
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SecurityError(400, "INVALID_JSON", "请求不是有效的 JSON");
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

let hmacKeyPromise: Promise<CryptoKey> | null = null;

function getHmacKey(): Promise<CryptoKey> {
  if (hmacKeyPromise) return hmacKeyPromise;
  const secret = Deno.env.get("AI_SESSION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32) {
    throw new SecurityError(503, "SESSION_SECRET_MISSING", "AI 会话密钥未配置");
  }
  hmacKeyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(`kimi-ai-session-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return hmacKeyPromise;
}

async function signTokenPart(payloadPart: string): Promise<Uint8Array> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`v1.${payloadPart}`));
  return new Uint8Array(signature);
}

export async function createAiSessionToken(payload: AiSessionPayload): Promise<string> {
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signaturePart = toBase64Url(await signTokenPart(payloadPart));
  return `${payloadPart}.${signaturePart}`;
}

export async function verifyAiSession(req: Request): Promise<AiSessionPayload> {
  const origin = assertAllowedOrigin(req);
  const token = req.headers.get("x-kimi-ai-session")?.trim() || "";
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) {
    throw new SecurityError(401, "AI_SESSION_REQUIRED", "请先连接钱包并完成 AI 安全签名");
  }

  let actualSignature: Uint8Array;
  let payload: AiSessionPayload;
  try {
    actualSignature = fromBase64Url(signaturePart);
    payload = JSON.parse(decoder.decode(fromBase64Url(payloadPart))) as AiSessionPayload;
  } catch {
    throw new SecurityError(401, "AI_SESSION_INVALID", "AI 安全会话无效，请重新签名");
  }

  const expectedSignature = await signTokenPart(payloadPart);
  if (!constantTimeEqual(actualSignature, expectedSignature)) {
    throw new SecurityError(401, "AI_SESSION_INVALID", "AI 安全会话签名无效");
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload?.v !== 1 ||
    !/^0x[a-fA-F0-9]{40}$/.test(payload.wallet || "") ||
    payload.origin !== origin ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    payload.iat > now + 60 ||
    payload.exp <= now ||
    payload.exp - payload.iat > 1_800
  ) {
    throw new SecurityError(401, "AI_SESSION_EXPIRED", "AI 安全会话已过期，请重新签名");
  }

  assertWalletNotBlocked(payload.wallet);

  return payload;
}

// Wallet blocklist helpers.

function normalizeWallet(value: string): string {
  return value.trim().toLowerCase();
}

export function assertWalletNotBlocked(wallet: string): void {
  const normalized = normalizeWallet(wallet);
  if (blockedWallets.has(normalized)) {
    throw new SecurityError(403, "WALLET_BLOCKED", "该钱包已被禁止调用 AI 服务");
  }
  const autoBlock = autoBlockedWallets.get(normalized);
  if (autoBlock && autoBlock.until > Date.now()) {
    throw new SecurityError(
      403,
      "WALLET_AUTO_BLOCKED",
      `该钱包因频繁调用被临时封禁，${Math.ceil((autoBlock.until - Date.now()) / 1000 / 60)} 分钟后恢复`
    );
  }
}

export function isWalletBlocked(wallet: string): boolean {
  const normalized = normalizeWallet(wallet);
  if (blockedWallets.has(normalized)) return true;
  const autoBlock = autoBlockedWallets.get(normalized);
  if (autoBlock && autoBlock.until > Date.now()) return true;
  return false;
}

/**
 * Record a strike against a wallet. If it exceeds the threshold within the window,
 * the wallet is automatically blocked for the configured duration.
 */
export function recordWalletStrike(
  wallet: string,
  reason: string,
  options?: { threshold?: number; windowMs?: number; blockDurationMs?: number }
): void {
  const normalized = normalizeWallet(wallet);
  const threshold = options?.threshold ?? readPositiveInt("AUTO_BLOCK_STRIKE_THRESHOLD", 10, 100);
  const windowMs = options?.windowMs ?? readPositiveInt("AUTO_BLOCK_STRIKE_WINDOW_MS", 60_000, 600_000);
  const blockDurationMs =
    options?.blockDurationMs ??
    readPositiveInt("AUTO_BLOCK_DURATION_MS", 60 * 60_000, 24 * 60 * 60_000);

  const now = Date.now();
  const bucket = walletStrikeBuckets.get(normalized);
  if (!bucket || now >= bucket.resetAt) {
    walletStrikeBuckets.set(normalized, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > threshold) {
    autoBlockedWallets.set(normalized, { until: now + blockDurationMs, reason });
    console.warn("[ai-security] auto-blocked wallet", { wallet: normalized, reason, until: now + blockDurationMs });
    walletStrikeBuckets.delete(normalized);
  }

  if (walletStrikeBuckets.size > 5_000) {
    for (const [key, value] of walletStrikeBuckets) {
      if (now >= value.resetAt) walletStrikeBuckets.delete(key);
    }
  }
}

// Simple math CAPTCHA helpers.

let captchaHmacKeyPromise: Promise<CryptoKey> | null = null;

function getCaptchaHmacKey(): Promise<CryptoKey> {
  if (captchaHmacKeyPromise) return captchaHmacKeyPromise;
  const secret = Deno.env.get("AI_CAPTCHA_SECRET") || Deno.env.get("AI_SESSION_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32) {
    throw new SecurityError(503, "CAPTCHA_SECRET_MISSING", "验证码密钥未配置");
  }
  captchaHmacKeyPromise = crypto.subtle.importKey(
    "raw",
    encoder.encode(`kimi-ai-captcha-v1:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return captchaHmacKeyPromise;
}

async function signCaptchaToken(token: string): Promise<string> {
  const key = await getCaptchaHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(token));
  return toBase64Url(new Uint8Array(signature));
}

function buildCaptchaToken(a: number, b: number, answer: number, expiresAt: number): string {
  return toBase64Url(encoder.encode(JSON.stringify({ a, b, answer, exp: expiresAt })));
}

export interface CaptchaChallenge {
  question: string;
  token: string;
}

export async function createCaptchaChallenge(): Promise<CaptchaChallenge> {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const answer = a + b;
  const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const token = buildCaptchaToken(a, b, answer, expiresAt);
  const signature = await signCaptchaToken(token);
  return {
    question: `${a} + ${b} = ?`,
    token: `${token}.${signature}`,
  };
}

export async function verifyCaptchaAnswer(tokenWithSignature: string, answer: string): Promise<void> {
  if (typeof answer !== "string" || !/^\d{1,3}$/.test(answer.trim())) {
    throw new SecurityError(400, "CAPTCHA_ANSWER_INVALID", "请输入正确的验证码答案");
  }
  const [tokenPart, signaturePart, extra] = tokenWithSignature.split(".");
  if (!tokenPart || !signaturePart || extra) {
    throw new SecurityError(400, "CAPTCHA_TOKEN_INVALID", "验证码令牌无效");
  }

  let payload: { a: number; b: number; answer: number; exp: number };
  try {
    payload = JSON.parse(decoder.decode(fromBase64Url(tokenPart))) as typeof payload;
    const expectedSignature = await signCaptchaToken(tokenPart);
    if (!constantTimeEqual(fromBase64Url(signaturePart), expectedSignature)) {
      throw new SecurityError(400, "CAPTCHA_TOKEN_INVALID", "验证码签名无效");
    }
  } catch {
    throw new SecurityError(400, "CAPTCHA_TOKEN_INVALID", "验证码校验失败");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) {
    throw new SecurityError(400, "CAPTCHA_EXPIRED", "验证码已过期，请刷新");
  }
  if (!Number.isInteger(payload.a) || !Number.isInteger(payload.b) || !Number.isInteger(payload.answer)) {
    throw new SecurityError(400, "CAPTCHA_TOKEN_INVALID", "验证码令牌无效");
  }
  if (Number(answer.trim()) !== payload.answer) {
    throw new SecurityError(400, "CAPTCHA_WRONG", "验证码答案错误");
  }
}

export function buildWalletAccessMessage(input: {
  origin: string;
  address: string;
  timestamp: number;
  nonce: string;
}): string {
  return [
    "Kimi AI 安全访问授权",
    `站点: ${input.origin}`,
    `钱包: ${input.address.toLowerCase()}`,
    `时间: ${input.timestamp}`,
    `随机码: ${input.nonce}`,
    "此签名不会发送交易，也不会扣除代币。",
  ].join("\n");
}
