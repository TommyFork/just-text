import { NextRequest, NextResponse } from "next/server";
import {
	EXPIRY_OPTIONS,
	FORMAT_OPTIONS,
	MAX_PASTE_SIZE_BYTES,
	type PasteFormat,
} from "@/lib/constants";
import { getClientIp } from "@/lib/ip";
import { type CreatePasteInput, createPaste } from "@/lib/paste";
import { checkPasteRateLimit } from "@/lib/rate-limit";
import { getBaseUrl } from "@/lib/utils";

// ~7MB: accounts for Base64URL expansion (~1.37x) of a 5MB plaintext + 16-byte GCM tag
const MAX_CIPHERTEXT_LENGTH = 7 * 1024 * 1024;

function isValidPasteBody(body: unknown): body is {
	ciphertext: string;
	iv: string;
	format: PasteFormat;
	language?: string;
	expirySeconds: number;
	burnAfterRead?: boolean;
	sizeBytes: number;
} {
	if (typeof body !== "object" || body === null) return false;

	const b = body as Record<string, unknown>;

	if (typeof b.ciphertext !== "string" || b.ciphertext.length === 0) {
		return false;
	}

	if (typeof b.iv !== "string" || b.iv.length === 0) {
		return false;
	}

	// iv must decode to exactly 12 bytes (AES-GCM NIST recommendation)
	try {
		const ivPadded = b.iv.replace(/-/g, "+").replace(/_/g, "/");
		const decoded = atob(
			ivPadded + "=".repeat((4 - (ivPadded.length % 4)) % 4),
		);
		if (decoded.length !== 12) return false;
	} catch {
		return false;
	}

	const validFormats = FORMAT_OPTIONS.map((f) => f.value);
	if (!validFormats.includes(b.format as PasteFormat)) return false;

	const validExpiries = EXPIRY_OPTIONS.map((e) => e.value);
	if (
		typeof b.expirySeconds !== "number" ||
		!validExpiries.includes(b.expirySeconds as (typeof validExpiries)[number])
	) {
		return false;
	}

	if (b.format === "code" && b.language !== undefined) {
		if (typeof b.language !== "string") return false;
	}

	if (
		typeof b.sizeBytes !== "number" ||
		b.sizeBytes < 0 ||
		b.sizeBytes > MAX_PASTE_SIZE_BYTES
	) {
		return false;
	}

	return true;
}

export async function POST(request: NextRequest) {
	try {
		const ip = await getClientIp();
		const rateLimit = await checkPasteRateLimit(ip);

		if (!rateLimit.allowed) {
			return NextResponse.json(
				{ error: "Rate limit exceeded. Try again later." },
				{
					status: 429,
					headers: {
						"Retry-After": String(
							rateLimit.resetAt - Math.floor(Date.now() / 1000),
						),
						"X-RateLimit-Remaining": String(rateLimit.remaining),
					},
				},
			);
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		if (!isValidPasteBody(body)) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		if (body.ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
			return NextResponse.json(
				{ error: "Content exceeds maximum size of 5MB" },
				{ status: 400 },
			);
		}

		const input: CreatePasteInput = {
			ciphertext: body.ciphertext,
			iv: body.iv,
			format: body.format,
			language: body.format === "code" ? body.language : undefined,
			expirySeconds: body.expirySeconds,
			burnAfterRead: Boolean(body.burnAfterRead),
			sizeBytes: body.sizeBytes,
		};

		const paste = await createPaste(input);
		const baseUrl = getBaseUrl(request.url);

		// Note: the hash fragment (#KEY) is appended client-side — the server
		// never knows the encryption key.
		return NextResponse.json(
			{
				id: paste.id,
				url: `${baseUrl}/${paste.id}`,
				rawUrl: `${baseUrl}/text/${paste.id}`,
				expiresAt: paste.expiresAt,
				sizeBytes: paste.sizeBytes,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error("Error creating paste:", error);
		return NextResponse.json(
			{ error: "Failed to create paste" },
			{ status: 500 },
		);
	}
}
