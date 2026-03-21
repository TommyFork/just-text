import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { getPaste } from "@/lib/paste";
import { checkReadRateLimit } from "@/lib/rate-limit";

// NOTE: This endpoint returns the raw *ciphertext* (Base64URL-encoded AES-256-GCM).
// The server cannot decrypt it — the key lives only in the URL hash fragment (#KEY)
// on the client. Use the "Copy CLI Command" button on the paste page to get a
// Node.js one-liner that decrypts locally.

function logApiError(context: string, error: unknown): void {
	if (error instanceof Error) {
		console.error(`Error ${context}:`, error.message);
	} else {
		console.error(`Error ${context}:`, error);
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const ip = await getClientIp();
		const rateLimit = await checkReadRateLimit(ip);

		if (!rateLimit.allowed) {
			return new NextResponse("Rate limit exceeded", { status: 429 });
		}

		const paste = await getPaste(id);
		if (!paste) {
			return new NextResponse("Not found", { status: 404 });
		}

		return new NextResponse(paste.ciphertext, {
			status: 200,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
				// Signals to clients that this is E2EE ciphertext, not plaintext
				"X-E2EE": "client-encrypted; alg=AES-256-GCM",
				"Cache-Control": paste.burnAfterRead
					? "private, no-store"
					: "public, max-age=300",
			},
		});
	} catch (error) {
		logApiError("reading raw paste", error);
		return new NextResponse("Internal server error", { status: 500 });
	}
}
