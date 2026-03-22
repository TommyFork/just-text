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
	const now = Date.now();
	const windowMs = windowSeconds * 1000;

	// Use sliding window: count requests in the last windowMs milliseconds
	const windowStart = now - windowMs;
	const rateLimitKey = `ratelimit:${key}`;

	// Remove old entries outside the window
	await redis.zremrangebyscore(rateLimitKey, 0, windowStart);

	// Count current requests in window
	const currentCount = await redis.zcard(rateLimitKey);

	// Add current request
	await redis.zadd(rateLimitKey, now, `${now}:${Math.random()}`);

	// Set expiry on the key (cleanup)
	await redis.pexpire(rateLimitKey, windowMs);

	const newCount = currentCount + 1;
	const resetAt = Math.floor((now + windowMs) / 1000);

	return {
		allowed: newCount <= maxRequests,
		remaining: Math.max(0, maxRequests - newCount),
		resetAt,
	};
}

export async function checkRateLimitWithConfig(
	ip: string,
	type: "paste" | "read",
): Promise<RateLimitResult> {
	let max: number, window: number;

	if (type === "paste") {
		max = parseInt(process.env.RATE_LIMIT_PASTE_MAX ?? "10", 10);
		window = parseInt(
			process.env.RATE_LIMIT_PASTE_WINDOW_SECONDS ?? "3600",
			10,
		);
	} else {
		max = parseInt(process.env.RATE_LIMIT_READ_MAX ?? "60", 10);
		window = parseInt(process.env.RATE_LIMIT_READ_WINDOW_SECONDS ?? "60", 10);
	}

	return checkRateLimit(`${type}:${ip}`, max, window);
}

// Backward compatibility
export async function checkPasteRateLimit(
	ip: string,
): Promise<RateLimitResult> {
	return checkRateLimitWithConfig(ip, "paste");
}

export async function checkReadRateLimit(ip: string): Promise<RateLimitResult> {
	return checkRateLimitWithConfig(ip, "read");
}
