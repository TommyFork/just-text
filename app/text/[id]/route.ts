import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/error";
import { getClientIp } from "@/lib/ip";
import { getPaste } from "@/lib/paste";
import { checkReadRateLimit } from "@/lib/rate-limit";
import { isValidPasteId } from "@/lib/utils";

// NOTE: This endpoint returns the raw *ciphertext* (Base64URL-encoded AES-256-GCM).
// The server cannot decrypt it — the key lives only in the URL hash fragment (#KEY)
// on the client. Use the "Copy CLI Command" button on the paste page to get a
// Node.js one-liner that decrypts locally.

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;

		// Validate paste ID
		if (!isValidPasteId(id)) {
			return new NextResponse("Invalid paste ID", {
				status: 400,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
			});
		}

		const ip = await getClientIp();
		const rateLimit = await checkReadRateLimit(ip);

		if (!rateLimit.allowed) {
			return new NextResponse("Rate limit exceeded", {
				status: 429,
				headers: {
					"Retry-After": String(
						rateLimit.resetAt - Math.floor(Date.now() / 1000),
					),
					"Access-Control-Allow-Origin": "*",
				},
			});
		}

		const paste = await getPaste(id);
		if (!paste) {
			return new NextResponse("Not found", {
				status: 404,
				headers: {
					"Access-Control-Allow-Origin": "*",
				},
			});
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
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (error) {
		logApiError("reading raw paste", error);
		return new NextResponse("Internal server error", {
			status: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
		});
	}
}
