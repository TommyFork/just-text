import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../lib/redis", () => ({
	getRedis: vi.fn(),
}));

vi.mock("nanoid", () => ({
	nanoid: vi.fn(() => "testid1234"),
}));

import { createPaste, getPaste, getPasteMetadata } from "../../lib/paste";
import { getRedis } from "../../lib/redis";

// Minimal valid Base64URL strings for fixtures
const TEST_CIPHERTEXT = "dGVzdGNpcGhlcnRleHQ"; // "testciphertext" base64url
const TEST_IV = "AAAAAAAAAAAAAAAA"; // 12-byte IV base64url (16 chars = 12 bytes)

function makeMockRedis() {
	const store: Record<string, string> = {};
	const ttls: Record<string, number> = {};

	return {
		store,
		redis: {
			set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
				store[key] = value;
				const exIdx = (args as string[]).indexOf("EX");
				if (exIdx >= 0) {
					ttls[key] = args[exIdx + 1] as number;
				}
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
			eval: vi.fn(async (_script: string, _numkeys: number, key: string) => {
				const raw = store[key] ?? null;
				if (!raw) return null;
				try {
					const data = JSON.parse(raw);
					if (data.burnAfterRead) {
						delete store[key];
						return raw;
					}
					data.viewCount = (data.viewCount || 0) + 1;
					const updated = JSON.stringify(data);
					store[key] = updated;
					return updated;
				} catch {
					return null;
				}
			}),
		},
	};
}

describe("paste", () => {
	let mockRedis: ReturnType<typeof makeMockRedis>;

	beforeEach(() => {
		mockRedis = makeMockRedis();
		vi.mocked(getRedis).mockReturnValue(mockRedis.redis as never);
	});

	describe("createPaste", () => {
		it("creates a paste and returns it with correct fields", async () => {
			const result = await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
				sizeBytes: 11,
				passwordProtected: false,
			});

			expect(result.id).toBe("testid1234");
			expect(result.ciphertext).toBe(TEST_CIPHERTEXT);
			expect(result.iv).toBe(TEST_IV);
			expect(result.format).toBe("plain");
			expect(result.burnAfterRead).toBe(false);
			expect(result.viewCount).toBe(0);
			expect(result.sizeBytes).toBe(11);
		});

		it("stores ciphertext and iv in Redis (no plaintext)", async () => {
			await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
				sizeBytes: 4,
				passwordProtected: false,
			});

			const stored = JSON.parse(mockRedis.store["paste:testid1234"]);
			expect(stored.ciphertext).toBe(TEST_CIPHERTEXT);
			expect(stored.iv).toBe(TEST_IV);
			expect(stored).not.toHaveProperty("content");
		});

		it("sets TTL when expirySeconds > 0", async () => {
			await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
				sizeBytes: 4,
				passwordProtected: false,
			});

			expect(mockRedis.redis.set).toHaveBeenCalledWith(
				"paste:testid1234",
				expect.any(String),
				"EX",
				3600,
			);
		});

		it("does not set TTL when expirySeconds is 0", async () => {
			await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
				sizeBytes: 4,
				passwordProtected: false,
			});

			expect(mockRedis.redis.expire).not.toHaveBeenCalled();
			expect(mockRedis.redis.set).toHaveBeenCalledWith(
				"paste:testid1234",
				expect.any(String),
			);
		});

		it("throws when ciphertext is empty", async () => {
			await expect(
				createPaste({
					ciphertext: "",
					iv: TEST_IV,
					format: "plain",
					expirySeconds: 0,
					burnAfterRead: false,
					sizeBytes: 0,
					passwordProtected: false,
				}),
			).rejects.toThrow("Ciphertext cannot be empty");
		});

		it("sets expiresAt to null when expirySeconds is 0", async () => {
			const result = await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 0,
				burnAfterRead: false,
				sizeBytes: 4,
				passwordProtected: false,
			});
			expect(result.expiresAt).toBeNull();
		});

		it("sets expiresAt when expirySeconds > 0", async () => {
			const before = Math.floor(Date.now() / 1000);
			const result = await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				expirySeconds: 3600,
				burnAfterRead: false,
				sizeBytes: 4,
				passwordProtected: false,
			});
			const after = Math.floor(Date.now() / 1000);
			expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3600);
			expect(result.expiresAt).toBeLessThanOrEqual(after + 3600);
		});

		it("stores language field for code format", async () => {
			const result = await createPaste({
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "code",
				language: "typescript",
				expirySeconds: 0,
				burnAfterRead: false,
				sizeBytes: 12,
				passwordProtected: false,
			});

			expect(result.language).toBe("typescript");

			const stored = JSON.parse(mockRedis.store["paste:testid1234"]);
			expect(stored.language).toBe("typescript");
		});
	});

	describe("getPaste", () => {
		it("returns null for a missing paste", async () => {
			const result = await getPaste("nonexistent");
			expect(result).toBeNull();
		});

		it("returns the paste with ciphertext and iv intact", async () => {
			mockRedis.store["paste:abc123"] = JSON.stringify({
				id: "abc123",
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "plain",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 0,
				sizeBytes: 5,
			});

			const result = await getPaste("abc123");
			expect(result).not.toBeNull();
			expect(result!.ciphertext).toBe(TEST_CIPHERTEXT);
			expect(result!.iv).toBe(TEST_IV);
			expect(result!.id).toBe("abc123");
		});

		it("increments viewCount for non-burn pastes", async () => {
			mockRedis.store["paste:abc123"] = JSON.stringify({
				id: "abc123",
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
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
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
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
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
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

		it("returns null for corrupt JSON in Redis", async () => {
			mockRedis.store["paste:corrupt"] = "not valid json {{{";
			const result = await getPaste("corrupt");
			expect(result).toBeNull();
		});

		it("returns paste with language field", async () => {
			mockRedis.store["paste:lang1"] = JSON.stringify({
				id: "lang1",
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "code",
				language: "python",
				createdAt: 1000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 0,
				sizeBytes: 4,
			});

			const result = await getPaste("lang1");
			expect(result).not.toBeNull();
			expect(result!.language).toBe("python");
		});
	});

	describe("getPasteMetadata", () => {
		it("returns null for missing paste", async () => {
			expect(await getPasteMetadata("missing")).toBeNull();
		});

		it("returns metadata without ciphertext or iv fields", async () => {
			mockRedis.store["paste:meta1"] = JSON.stringify({
				id: "meta1",
				ciphertext: TEST_CIPHERTEXT,
				iv: TEST_IV,
				format: "markdown",
				createdAt: 2000,
				expiresAt: null,
				burnAfterRead: false,
				viewCount: 3,
				sizeBytes: 7,
			});

			const result = await getPasteMetadata("meta1");
			expect(result).not.toBeNull();
			expect(result).not.toHaveProperty("ciphertext");
			expect(result).not.toHaveProperty("iv");
			expect(result!.id).toBe("meta1");
			expect(result!.viewCount).toBe(3);
		});

		it("returns null for corrupt JSON", async () => {
			mockRedis.store["paste:bad"] = "{{invalid}}";
			expect(await getPasteMetadata("bad")).toBeNull();
		});
	});
});
