import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

// Generates a per-request cryptographic nonce for the Content-Security-Policy.
// This eliminates 'unsafe-inline' from script-src, which is critical for E2EE
// security since the decryption key lives in the URL hash — XSS is a fatal threat.

export function proxy(request: NextRequest) {
	// nanoid uses crypto.getRandomValues internally — suitable as a CSP nonce seed
	const nonce = Buffer.from(nanoid(32)).toString("base64");

	const csp = [
		"default-src 'self'",
		// Nonce replaces 'unsafe-inline'; allowlist GA tag manager explicitly
		`script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com`,
		// Tailwind inline styles and Shiki's style injections still require this
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self' data:",
		"connect-src 'self' https://www.google-analytics.com https://analytics.google.com",
		// Required for Web Workers spawned via new Worker(new URL(..., import.meta.url))
		"worker-src 'self' blob:",
		"frame-ancestors 'none'",
	].join("; ");

	// Pass nonce to the layout server component via a request header
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});
	response.headers.set("Content-Security-Policy", csp);

	return response;
}

export const config = {
	matcher: [
		// Apply to all routes except Next.js internals and static files
		"/((?!_next/static|_next/image|favicon.ico).*)",
	],
};
