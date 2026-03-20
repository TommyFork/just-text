import type { NextConfig } from "next";

// 'unsafe-eval' is only needed in development for webpack hot module replacement.
// It is not used in production builds and is removed here to tighten the CSP.
// NOTE: 'unsafe-inline' is still required because Next.js inlines hydration scripts.
// For a fully strict CSP, implement nonce-based headers via Next.js middleware.
const scriptSrc =
	process.env.NODE_ENV === "development"
		? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com"
		: "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com";

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Referrer-Policy", value: "no-referrer" },
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
					{
						key: "Content-Security-Policy",
						value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com; frame-ancestors 'none';`,
					},
				],
			},
		];
	},
};

export default nextConfig;
