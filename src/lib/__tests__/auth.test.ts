import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ set: mockCookieSet });

vi.mock("next/headers", () => ({ cookies: mockCookies }));

const mockSign = vi.fn().mockResolvedValue("mock-jwt-token");
const mockSetExpirationTime = vi.fn().mockReturnThis();
const mockSetIssuedAt = vi.fn().mockReturnThis();
const mockSetProtectedHeader = vi.fn().mockReturnThis();

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: mockSetProtectedHeader,
    setExpirationTime: mockSetExpirationTime,
    setIssuedAt: mockSetIssuedAt,
    sign: mockSign,
  })),
  jwtVerify: vi.fn(),
}));

import { createSession } from "@/lib/auth";
import { SignJWT } from "jose";

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSign.mockResolvedValue("mock-jwt-token");
    mockCookies.mockResolvedValue({ set: mockCookieSet });
  });

  it("creates a JWT with HS256 algorithm and 7d expiry", async () => {
    await createSession("user-123", "user@example.com");

    expect(SignJWT).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-123", email: "user@example.com" })
    );
    expect(mockSetProtectedHeader).toHaveBeenCalledWith({ alg: "HS256" });
    expect(mockSetExpirationTime).toHaveBeenCalledWith("7d");
    expect(mockSetIssuedAt).toHaveBeenCalled();
    expect(mockSign).toHaveBeenCalled();
  });

  it("sets an httpOnly cookie with the token", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("sets cookie path to /", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({ path: "/" })
    );
  });

  it("sets sameSite to lax", async () => {
    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({ sameSite: "lax" })
    );
  });

  it("sets cookie expiry approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-123", "user@example.com");
    const after = Date.now();

    const cookieOptions = mockCookieSet.mock.calls[0][2];
    const expires: Date = cookieOptions.expires;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  it("embeds expiresAt in the JWT payload", async () => {
    const before = Date.now();
    await createSession("user-123", "user@example.com");

    const payload = (SignJWT as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.expiresAt).toBeDefined();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(payload.expiresAt).getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  });

  it("sets secure: true in production", async () => {
    const original = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");

    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({ secure: true })
    );

    vi.stubEnv("NODE_ENV", original);
  });

  it("sets secure: false outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await createSession("user-123", "user@example.com");

    expect(mockCookieSet).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({ secure: false })
    );
  });
});
