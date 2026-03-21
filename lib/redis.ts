import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
	if (!redis) {
		const url = process.env.REDIS_URL;
		if (!url) {
			throw new Error("REDIS_URL environment variable is not set");
		}
		redis = new Redis(url, {
			maxRetriesPerRequest: 3,
			retryStrategy(times) {
				if (times > 3) return null;
				return Math.min(times * 200, 2000);
			},
		});

		// Handle graceful shutdown
		const handleShutdown = () => {
			if (redis) {
				redis.disconnect();
				redis = null;
			}
		};

		process.on("beforeExit", handleShutdown);
		process.on("SIGTERM", handleShutdown);
		process.on("SIGINT", handleShutdown);
	}
	return redis;
}
