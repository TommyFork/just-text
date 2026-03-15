import { headers } from "next/headers";

export async function getClientIp(): Promise<string> {
	const h = await headers();

	// x-real-ip is set by reverse proxies (nginx, etc.) from the actual TCP socket address
	// and cannot be spoofed by the client. Prefer it over x-forwarded-for.
	const realIp = h.get("x-real-ip");
	if (realIp) return realIp.trim();

	// x-forwarded-for is a comma-separated list where each proxy appends the previous hop.
	// The rightmost value is added by the closest trusted proxy and is harder to spoof
	// than the leftmost (which can be set by the client directly).
	const forwarded = h.get("x-forwarded-for");
	if (forwarded) {
		const ips = forwarded.split(",");
		const last = ips[ips.length - 1]?.trim();
		if (last) return last;
	}

	return "unknown";
}
