import { getRedis } from "./redis";

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

export async function checkRateLimit(
	key: string,
	maxRequests: number,
	windowSeconds: number,
): Promise<RateLimitResult> {
	const redis = getRedis();
	const now = Math.floor(Date.now() / 1000);
	const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`;

	const pipeline = redis.pipeline();
	pipeline.incr(windowKey);
	pipeline.expire(windowKey, windowSeconds);
	const results = await pipeline.exec();

	const count = (results?.[0]?.[1] as number) ?? 0;
	const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;

	return {
		allowed: count <= maxRequests,
		remaining: Math.max(0, maxRequests - count),
		resetAt,
	};
}

export async function checkPasteRateLimit(
	ip: string,
): Promise<RateLimitResult> {
	const max = parseInt(process.env.RATE_LIMIT_PASTE_MAX ?? "10", 10);
	const window = parseInt(
		process.env.RATE_LIMIT_PASTE_WINDOW_SECONDS ?? "3600",
		10,
	);
	return checkRateLimit(`paste:${ip}`, max, window);
}

export async function checkReadRateLimit(ip: string): Promise<RateLimitResult> {
	const max = parseInt(process.env.RATE_LIMIT_READ_MAX ?? "60", 10);
	const window = parseInt(
		process.env.RATE_LIMIT_READ_WINDOW_SECONDS ?? "60",
		10,
	);
	return checkRateLimit(`read:${ip}`, max, window);
}
