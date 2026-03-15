import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		coverage: {
			provider: "v8",
			include: ["lib/**/*.ts"],
			exclude: ["lib/redis.ts", "lib/highlight.ts"],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
