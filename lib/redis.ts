import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
	if (!redis) {
		const rawUrl = process.env.REDIS_URL;
		if (!rawUrl) {
			throw new Error("REDIS_URL environment variable is not set");
		}

		// Parse the URL ourselves using the WHATWG URL API to avoid ioredis
		// triggering the [DEP0169] url.parse() deprecation warning internally.
		const parsed = new URL(rawUrl);

		redis = new Redis({
			host: parsed.hostname,
			port: parsed.port ? Number(parsed.port) : 6379,
			username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
			password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
			db: parsed.pathname && parsed.pathname !== "/" ? Number(parsed.pathname.slice(1)) : 0,
			tls: parsed.protocol === "rediss:" ? {} : undefined,
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
