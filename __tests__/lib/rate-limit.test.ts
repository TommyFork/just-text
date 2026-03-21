import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/redis", () => ({
	getRedis: vi.fn(),
}));

import {
	checkPasteRateLimit,
	checkRateLimit,
	checkReadRateLimit,
} from "../../lib/rate-limit";
import { getRedis } from "../../lib/redis";

function makeRedisMock(currentCount: number) {
	return {
		zremrangebyscore: vi.fn().mockResolvedValue(0),
		zcard: vi.fn().mockResolvedValue(currentCount),
		zadd: vi.fn().mockResolvedValue(1),
		pexpire: vi.fn().mockResolvedValue(1),
	};
}

describe("rate-limit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.RATE_LIMIT_PASTE_MAX;
		delete process.env.RATE_LIMIT_PASTE_WINDOW_SECONDS;
		delete process.env.RATE_LIMIT_READ_MAX;
		delete process.env.RATE_LIMIT_READ_WINDOW_SECONDS;
	});

	describe("checkRateLimit", () => {
		it("allows requests under the limit", async () => {
			// zcard returns 0 existing, after zadd count is 1, remaining = 9
			const redis = makeRedisMock(0);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(9);
		});

		it("allows requests at the limit", async () => {
			// zcard returns 9 existing, after zadd count is 10, remaining = 0
			const redis = makeRedisMock(9);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(0);
		});

		it("blocks requests over the limit", async () => {
			// zcard returns 10 existing, after zadd count is 11, over limit
			const redis = makeRedisMock(10);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("returns a resetAt timestamp in the future", async () => {
			const redis = makeRedisMock(0);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const before = Math.floor(Date.now() / 1000);
			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.resetAt).toBeGreaterThan(before);
		});

		it("calls zremrangebyscore, zcard, zadd, and pexpire", async () => {
			const redis = makeRedisMock(0);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			await checkRateLimit("test:ip", 10, 60);
			expect(redis.zremrangebyscore).toHaveBeenCalledTimes(1);
			expect(redis.zcard).toHaveBeenCalledTimes(1);
			expect(redis.zadd).toHaveBeenCalledTimes(1);
			expect(redis.pexpire).toHaveBeenCalledTimes(1);
		});
	});

	describe("checkPasteRateLimit", () => {
		it("uses default max of 10", async () => {
			// zcard returns 9 existing, after zadd count is 10 (at limit)
			const redis = makeRedisMock(9);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(true);
		});

		it("blocks at 11 with default max", async () => {
			// zcard returns 10 existing, after zadd count is 11 (over limit)
			const redis = makeRedisMock(10);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});

		it("respects RATE_LIMIT_PASTE_MAX env var", async () => {
			process.env.RATE_LIMIT_PASTE_MAX = "5";
			// zcard returns 5 existing, after zadd count is 6 (over limit of 5)
			const redis = makeRedisMock(5);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});
	});

	describe("checkReadRateLimit", () => {
		it("uses default max of 60", async () => {
			// zcard returns 59 existing, after zadd count is 60 (at limit)
			const redis = makeRedisMock(59);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(true);
		});

		it("blocks at 61 with default max", async () => {
			// zcard returns 60 existing, after zadd count is 61 (over limit)
			const redis = makeRedisMock(60);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});

		it("respects RATE_LIMIT_READ_MAX env var", async () => {
			process.env.RATE_LIMIT_READ_MAX = "20";
			// zcard returns 20 existing, after zadd count is 21 (over limit of 20)
			const redis = makeRedisMock(20);
			vi.mocked(getRedis).mockReturnValue(redis as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});
	});
});
