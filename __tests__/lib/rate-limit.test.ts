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

function makePipelineMock(incrResult: number) {
	const pipeline = {
		incr: vi.fn().mockReturnThis(),
		expire: vi.fn().mockReturnThis(),
		exec: vi.fn().mockResolvedValue([
			[null, incrResult],
			[null, 1],
		]),
	};
	return pipeline;
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
			const pipeline = makePipelineMock(1);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(9);
		});

		it("allows requests at the limit", async () => {
			const pipeline = makePipelineMock(10);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(0);
		});

		it("blocks requests over the limit", async () => {
			const pipeline = makePipelineMock(11);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("returns a resetAt timestamp in the future", async () => {
			const pipeline = makePipelineMock(1);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const before = Math.floor(Date.now() / 1000);
			const result = await checkRateLimit("test:ip", 10, 60);
			expect(result.resetAt).toBeGreaterThan(before);
		});

		it("calls pipeline incr and expire", async () => {
			const pipeline = makePipelineMock(1);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			await checkRateLimit("test:ip", 10, 60);
			expect(pipeline.incr).toHaveBeenCalledTimes(1);
			expect(pipeline.expire).toHaveBeenCalledTimes(1);
			expect(pipeline.exec).toHaveBeenCalledTimes(1);
		});
	});

	describe("checkPasteRateLimit", () => {
		it("uses default max of 10", async () => {
			const pipeline = makePipelineMock(10);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(true);
		});

		it("blocks at 11 with default max", async () => {
			const pipeline = makePipelineMock(11);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});

		it("respects RATE_LIMIT_PASTE_MAX env var", async () => {
			process.env.RATE_LIMIT_PASTE_MAX = "5";
			const pipeline = makePipelineMock(6);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkPasteRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});
	});

	describe("checkReadRateLimit", () => {
		it("uses default max of 60", async () => {
			const pipeline = makePipelineMock(60);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(true);
		});

		it("blocks at 61 with default max", async () => {
			const pipeline = makePipelineMock(61);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});

		it("respects RATE_LIMIT_READ_MAX env var", async () => {
			process.env.RATE_LIMIT_READ_MAX = "20";
			const pipeline = makePipelineMock(21);
			vi.mocked(getRedis).mockReturnValue({
				pipeline: () => pipeline,
			} as never);

			const result = await checkReadRateLimit("1.2.3.4");
			expect(result.allowed).toBe(false);
		});
	});
});
