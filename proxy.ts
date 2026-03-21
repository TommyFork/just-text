import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

// Generates a per-request cryptographic nonce for the Content-Security-Policy.
// This eliminates 'unsafe-inline' from script-src, which is critical for E2EE
// security since the decryption key lives in the URL hash — XSS is a fatal threat.

export function proxy(request: NextRequest) {
	// nanoid uses crypto.getRandomValues internally — suitable as a CSP nonce seed
	const nonce = Buffer.from(nanoid(32)).toString("base64");

	// Vercel injects a live feedback toolbar on preview deployments — allowlist it
	// there only so production keeps a strict script-src.
	const isPreview = process.env.VERCEL_ENV === "preview";

	const csp = [
		"default-src 'self'",
		// Nonce replaces 'unsafe-inline'; allowlist GA tag manager explicitly
		// On preview deployments Vercel injects a toolbar with an inline bootstrap
		// script. We allow only that specific script by its sha256 hash rather than
		// 'unsafe-inline', so arbitrary inline scripts remain blocked even on preview.
		// If Vercel updates the toolbar the hash changes and the toolbar silently
		// breaks (CSP violation in console) — not a security issue, just cosmetic.
		`script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com${isPreview ? " https://vercel.live 'sha256-swwZR+NXg32d7EaRirit+Gzs3edtfXLd8ejkuL2DzYM='" : ""}`,
		// Tailwind inline styles and Shiki's style injections still require this
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self' data:",
		`connect-src 'self' https://www.google-analytics.com https://analytics.google.com${isPreview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
		// Required for Web Workers spawned via new Worker(new URL(..., import.meta.url))
		"worker-src 'self' blob:",
		`frame-src 'none'${isPreview ? " https://vercel.live" : ""}`,
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
