import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PASTE_SIZE_BYTES } from "../../lib/constants";

// Mock dependencies before importing the module under test
vi.mock("../../lib/redis", () => ({
	getRedis: vi.fn(),
}));

vi.mock("../../lib/crypto", () => ({
	encrypt: vi.fn((text: string) => `enc:${text}`),
	decrypt: vi.fn((text: string) => text.replace(/^enc:/, "")),
}));

vi.mock("nanoid", () => ({
	nanoid: vi.fn(() => "testid1234"),
}));

import {
	createPaste,
	getPaste,
	getPasteMetadata,
	reportPaste,
} from "../../lib/paste";
import { getRedis } from "../../lib/redis";

function makeMockRedis() {
	const store: Record<string, string> = {};
	const ttls: Record<string, number> = {};
	const lists: Record<string, string[]> = {};

	return {
		store,
		redis: {
			set: vi.fn(async (key: string, value: string) => {
				store[key] = value;
				return "OK";
			}),
			get: vi.fn(async (key: string) => store[key] ?? null),
			del: vi.fn(async (key: string) => {
				delete store[key];
				return 1;
			}),
			exists: vi.fn(async (key: string) => (store[key] !== undefined ? 1 : 0)),
			expire: vi.fn(async (key: string, ttl: number) => {
				ttls[key] = ttl;
				return 1;
			}),
			ttl: vi.fn(async (key: string) => ttls[key] ?? -1),
			lpush: vi.fn(async (key: string, value: string) => {
				lists[key] = lists[key] ?? [];
				lists[key].unshift(value);
				return lists[key].length;
			}),
			llen: vi.fn(async (key: string) => (lists[key] ?? []).length),
			// Simulate the atomic Lua script used by getPaste.
			// Handles both burn-after-read (get+delete) and normal reads (get+increment+set).
			eval: vi.fn(async (_script: string, _numkeys: number, key: string) => {
				const raw = store[key] ?? null;
				if (!raw) return null;
				const data = JSON.parse(raw);
				if (data.burnAfterRead) {
					delete store[key];
					return raw;
				}
				data.viewCount = (data.viewCount || 0) + 1;
				const updated = JSON.stringify(data);
				store[key] = updated;
				return updated;
			}),
		},
	};
}

describe("paste", () => {
	let mockRedis: ReturnType<typeof makeMockRedis>;

	beforeEach(() => {
		mockRedis = makeMockRedis();
		vi.mocked(getRedis).mockReturnValue(mockRedis.redis as never);
		process.env.ENCRYPTION_KEY = "a".repeat(64);
	});

	describe("createPaste", () => {
		it("creates a paste and returns it with decrypted content", async () => {
			const result = await createPaste({
				content: "hello world",
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
			});

			expect(result.id).toBe("testid1234");
			expect(result.content).toBe("hello world");
			expect(result.format).toBe("plain");
			expect(result.burnAfterRead).toBe(false);
			expect(result.viewCount).toBe(0);
			expect(result.sizeBytes).toBe(Buffer.byteLength("hello world", "utf8"));
		});

		it("stores encrypted content in Redis", async () => {
			await createPaste({
				content: "secret",
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
			});

			const stored = JSON.parse(mockRedis.store["paste:testid1234"]);
			expect(stored.content).toBe("enc:secret");
		});

		it("sets TTL when expirySeconds > 0", async () => {
			await createPaste({
				content: "expires soon",
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
			});

			expect(mockRedis.redis.expire).toHaveBeenCalledWith(
				"paste:testid1234",
				3600,
			);
		});

		it("does not set TTL when expirySeconds is 0", async () => {
			await createPaste({
				content: "never expires",
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
			});

			expect(mockRedis.redis.expire).not.toHaveBeenCalled();
		});

		it("throws when content is empty", async () => {
			await expect(
				createPaste({
					content: "",
					format: "plain",
					expirySeconds: 0,
					burnAfterRead: false,
				}),
			).rejects.toThrow("Content cannot be empty");
		});

		it("throws when content exceeds max size", async () => {
			const huge = "x".repeat(MAX_PASTE_SIZE_BYTES + 1);
			await expect(
				createPaste({
					content: huge,
					format: "plain",
					expirySeconds: 0,
					burnAfterRead: false,
				}),
			).rejects.toThrow("exceeds maximum size");
		});

		it("sets expiresAt to null when expirySeconds is 0", async () => {
			const result = await createPaste({
				content: "no expiry",
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
			});
			expect(result.expiresAt).toBeNull();
		});

		it("sets expiresAt when expirySeconds > 0", async () => {
			const before = Math.floor(Date.now() / 1000);
			const result = await createPaste({
				content: "expires",
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
			});
			const after = Math.floor(Date.now() / 1000);
			expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600);
			expect(result.expiresAt).toBeLessThanOrEqual(after + 3600);
		});
	});

	describe("getPaste", () => {
		it("returns null for a missing paste", async () => {
			const result = await getPaste("nonexistent");
			expect(result).toBeNull();
		});

		it("returns the paste with decrypted content", async () => {
			mockRedis.store["paste:abc123"] = JSON.stringify({
				id: "abc123",
				content: "enc:hello",
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 0,
				sizeBytes: 5,
			});

			const result = await getPaste("abc123");
			expect(result).not.toBeNull();
			expect(result!.content).toBe("hello");
			expect(result!.id).toBe("abc123");
		});

		it("increments viewCount for non-burn pastes", async () => {
			mockRedis.store["paste:abc123"] = JSON.stringify({
				id: "abc123",
				content: "enc:test",
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 5,
				sizeBytes: 4,
			});

			const result = await getPaste("abc123");
			expect(result!.viewCount).toBe(6);
		});

		it("burn-after-read paste is deleted after first read", async () => {
			mockRedis.store["paste:burn1"] = JSON.stringify({
				id: "burn1",
				content: "enc:secret",
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: true,
				viewCount: 0,
				sizeBytes: 6,
			});

			const result = await getPaste("burn1");
			expect(result).not.toBeNull();
			expect(mockRedis.store["paste:burn1"]).toBeUndefined();
		});

		it("burn-after-read paste is gone after first read", async () => {
			mockRedis.store["paste:burn2"] = JSON.stringify({
				id: "burn2",
				content: "enc:gone",
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: true,
				viewCount: 0,
				sizeBytes: 4,
			});

			await getPaste("burn2");
			const second = await getPaste("burn2");
			expect(second).toBeNull();
		});
	});

	describe("getPasteMetadata", () => {
		it("returns null for missing paste", async () => {
			expect(await getPasteMetadata("missing")).toBeNull();
		});

		it("returns metadata without content field", async () => {
			mockRedis.store["paste:meta1"] = JSON.stringify({
				id: "meta1",
				content: "enc:private",
				format: "markdown",
				createdAt: 2000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 3,
				sizeBytes: 7,
			});

			const result = await getPasteMetadata("meta1");
			expect(result).not.toBeNull();
			expect(result).not.toHaveProperty("content");
			expect(result!.id).toBe("meta1");
			expect(result!.viewCount).toBe(3);
		});
	});

	describe("reportPaste", () => {
		beforeEach(() => {
			// reportPaste verifies the paste exists before accepting the report
			mockRedis.store["paste:abc123"] = JSON.stringify({
				id: "abc123",
				content: "enc:test",
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 0,
				sizeBytes: 4,
			});
		});

		it("pushes a report to Redis", async () => {
			await reportPaste("abc123", "spam");
			expect(mockRedis.redis.lpush).toHaveBeenCalledWith(
				"report:abc123",
				expect.stringContaining("spam"),
			);
		});

		it("sets a 30-day TTL on the report key", async () => {
			await reportPaste("abc123", "spam");
			expect(mockRedis.redis.expire).toHaveBeenCalledWith(
				"report:abc123",
				30 * 24 * 60 * 60,
			);
		});

		it("throws when paste does not exist", async () => {
			await expect(reportPaste("nonexistent", "spam")).rejects.toThrow(
				"Paste not found",
			);
		});

		it("does not delete the paste regardless of report count", async () => {
			await reportPaste("abc123", "abuse");
			expect(mockRedis.store["paste:abc123"]).toBeDefined();
		});
	});
});
