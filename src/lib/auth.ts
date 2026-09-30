import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET needs at least 32 characters");
  return s;
}
export function hash(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function checkPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
export async function sign(payload: Record<string, unknown>, duration = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(duration)
    .sign(new TextEncoder().encode(secret()));
}
export async function verify(token: string) {
  try {
    return (
      await jwtVerify(token, new TextEncoder().encode(secret()), {
        algorithms: ["HS256"],
      })
    ).payload;
  } catch {
    return null;
  }
}
export async function session() {
  const token = (await cookies()).get("backing_session")?.value;
  return token ? await verify(token) : null;
}
export async function requireUser() {
  const s = await session();
  if (!s?.sub) throw new HttpError(401, "Sign in to continue.");
  return s;
}
export async function requireAdmin() {
  const s = await requireUser();
  if (s.role !== "admin")
    throw new HttpError(403, "Administrator access required.");
  return s;
}
export async function device() {
  const jar = await cookies();
  const existing = jar.get("backing_device")?.value;
  const payload = existing ? await verify(existing) : null;
  if (payload?.device) return hash(String(payload.device));
  const id = randomBytes(24).toString("hex");
  jar.set("backing_device", await sign({ device: id }, "365d"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ENV === "production",
    maxAge: 365 * 86400,
    path: "/",
  });
  return hash(id);
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.APP_ENV === "production",
    maxAge: 7 * 86400,
    path: "/",
  };
}
