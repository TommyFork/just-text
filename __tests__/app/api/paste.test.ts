import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as GET_PASTE } from "@/app/api/paste/[id]/route";
import { POST } from "@/app/api/paste/route";
import { GET as GET_RAW } from "@/app/text/[id]/route";

// Mock dependencies
vi.mock("@/lib/ip", () => ({
	getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/paste", () => ({
	createPaste: vi.fn().mockResolvedValue({
		id: "abc123", // 6 characters to match ID_LENGTH
		ciphertext: "encrypted-content",
		iv: "valid-iv-12bytes",
		format: "plain" as const,
		createdAt: 1234567890,
		expiresAt: 1234567890 + 604800,
		burnAfterRead: false,
		viewCount: 0,
		sizeBytes: 13,
	}),
	getPaste: vi.fn().mockResolvedValue({
		id: "abc123", // 6 characters to match ID_LENGTH
		ciphertext: "encrypted-content",
		iv: "valid-iv-12bytes",
		format: "plain" as const,
		createdAt: 1234567890,
		expiresAt: 1234567890 + 604800,
		burnAfterRead: false,
		viewCount: 0,
		sizeBytes: 13,
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	checkPasteRateLimit: vi.fn().mockResolvedValue({
		allowed: true,
		remaining: 9,
		resetAt: Date.now() / 1000 + 3600,
	}),
	checkReadRateLimit: vi.fn().mockResolvedValue({
		allowed: true,
		remaining: 59,
		resetAt: Date.now() / 1000 + 60,
	}),
}));

describe("API Routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
	});

	describe("POST /api/paste", () => {
		it("should create a paste successfully", async () => {
			// Create a valid 12-byte IV as base64url (no padding)
			const ivBytes = new Uint8Array(12);
			for (let i = 0; i < 12; i++) ivBytes[i] = i;
			const iv = Buffer.from(ivBytes)
				.toString("base64")
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=/g, "");

			const body = {
				ciphertext: "dGVzdGNvbnRlbnQ", // "testcontent" in base64
				iv,
				format: "plain" as const,
				expirySeconds: 604800,
				burnAfterRead: false,
				sizeBytes: 13,
				passwordProtected: false,
				key: "test-key-base64url",
			};

			const request = {
				json: vi.fn().mockResolvedValue(body),
				url: "http://localhost:3000/api/paste",
			} as unknown as NextRequest;

			const response = await POST(request);
			const data = await response.json();

			expect(response.status).toBe(201);
			expect(data).toMatchObject({
				id: "abc123",
				url: expect.stringContaining("/abc123"),
				sizeBytes: 13,
			});
		});

		it("should reject invalid JSON", async () => {
			const request = {
				json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
				url: "http://localhost:3000/api/paste",
			} as unknown as NextRequest;

			const response = await POST(request);
			expect(response.status).toBe(400);
		});

		it("should reject rate limited requests", async () => {
			const { checkPasteRateLimit } = await import("@/lib/rate-limit");
			vi.mocked(checkPasteRateLimit).mockResolvedValueOnce({
				allowed: false,
				remaining: 0,
				resetAt: Date.now() / 1000 + 3600,
			});

			const request = {
				json: vi.fn().mockResolvedValue({}),
				url: "http://localhost:3000/api/paste",
			} as unknown as NextRequest;

			const response = await POST(request);
			expect(response.status).toBe(429);
		});
	});

	describe("GET /api/paste/[id]", () => {
		it("should retrieve a paste successfully", async () => {
			const request = {
				url: "http://localhost:3000/api/paste/abc123",
			} as NextRequest;

			const response = await GET_PASTE(request, {
				params: Promise.resolve({ id: "abc123" }),
			});
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toMatchObject({
				id: "abc123",
				format: "plain",
				sizeBytes: 13,
			});
		});

		it("should reject invalid paste ID", async () => {
			const request = {
				url: "http://localhost:3000/api/paste/invalid!",
			} as NextRequest;

			const response = await GET_PASTE(request, {
				params: Promise.resolve({ id: "invalid!" }),
			});
			expect(response.status).toBe(400);
		});

		it("should return 404 for non-existent paste", async () => {
			const { getPaste } = await import("@/lib/paste");
			vi.mocked(getPaste).mockResolvedValueOnce(null);

			const request = {
				url: "http://localhost:3000/api/paste/abc123",
			} as NextRequest;

			const response = await GET_PASTE(request, {
				params: Promise.resolve({ id: "abc123" }),
			});
			expect(response.status).toBe(404);
		});
	});

	describe("GET /text/[id]", () => {
		it("should return raw ciphertext", async () => {
			const request = {
				url: "http://localhost:3000/text/abc123",
			} as NextRequest;

			const response = await GET_RAW(request, {
				params: Promise.resolve({ id: "abc123" }),
			});
			const text = await response.text();

			expect(response.status).toBe(200);
			expect(text).toBe("encrypted-content");
			expect(response.headers.get("Content-Type")).toBe(
				"text/plain; charset=utf-8",
			);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		});

		it("should reject invalid paste ID", async () => {
			const request = {
				url: "http://localhost:3000/text/invalid!",
			} as NextRequest;

			const response = await GET_RAW(request, {
				params: Promise.resolve({ id: "invalid!" }),
			});
			expect(response.status).toBe(400);
		});
	});
});
