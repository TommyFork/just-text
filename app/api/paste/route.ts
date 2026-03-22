import { NextRequest, NextResponse } from "next/server";
import {
	EXPIRY_OPTIONS,
	FORMAT_OPTIONS,
	MAX_PASTE_SIZE_BYTES,
	type PasteFormat,
} from "@/lib/constants";
import {
	createErrorResponse,
	createJsonResponse,
	logApiError,
} from "@/lib/error";
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
	passwordProtected: boolean;
	key?: string;
	salt?: string;
	wrappedKey?: string;
	wrapIv?: string;
} {
	if (typeof body !== "object" || body === null) return false;

	const b = body as Record<string, unknown>;

	if (typeof b.ciphertext !== "string" || b.ciphertext.length === 0) {
		return false;
	}

	if (typeof b.iv !== "string" || b.iv.length === 0) {
		return false;
	}

	if (typeof b.passwordProtected !== "boolean") {
		return false;
	}

	if (
		typeof b.sizeBytes !== "number" ||
		b.sizeBytes < 0 ||
		b.sizeBytes > MAX_PASTE_SIZE_BYTES
	) {
		return false;
	}

	if (b.passwordProtected) {
		if (
			typeof b.salt !== "string" ||
			typeof b.wrappedKey !== "string" ||
			typeof b.wrapIv !== "string"
		) {
			return false;
		}
		if (typeof b.key !== "string") {
			return false;
		}
	} else {
		if (typeof b.key !== "string" || b.key.length === 0) {
			return false;
		}
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

	return true;
}

export async function POST(request: NextRequest) {
	try {
		const ip = await getClientIp();
		const rateLimit = await checkPasteRateLimit(ip);

		if (!rateLimit.allowed) {
			return createErrorResponse(
				"Rate limit exceeded. Try again later.",
				429,
				"RATE_LIMIT_EXCEEDED",
				{
					"Retry-After": String(
						rateLimit.resetAt - Math.floor(Date.now() / 1000),
					),
					"X-RateLimit-Remaining": String(rateLimit.remaining),
					"Access-Control-Allow-Origin": "*",
				},
			);
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return createErrorResponse("Invalid JSON body", 400, "INVALID_JSON", {
				"Access-Control-Allow-Origin": "*",
			});
		}

		if (!isValidPasteBody(body)) {
			return createErrorResponse("Invalid request body", 400, "INVALID_BODY", {
				"Access-Control-Allow-Origin": "*",
			});
		}

		if (body.ciphertext.length > MAX_CIPHERTEXT_LENGTH) {
			return createErrorResponse(
				"Content exceeds maximum size of 5MB",
				400,
				"CONTENT_TOO_LARGE",
				{
					"Access-Control-Allow-Origin": "*",
				},
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
			passwordProtected: body.passwordProtected,
			key: body.key,
			salt: body.salt,
			wrappedKey: body.wrappedKey,
			wrapIv: body.wrapIv,
		};

		const paste = await createPaste(input);
		const baseUrl = getBaseUrl(request.url);

		// Note: the hash fragment (#KEY) is appended client-side — the server
		// never knows the encryption key.
		return createJsonResponse(
			{
				id: paste.id,
				url: `${baseUrl}/${paste.id}`,
				expiresAt: paste.expiresAt,
				sizeBytes: paste.sizeBytes,
				passwordProtected: paste.passwordProtected,
			},
			201,
			{
				"Access-Control-Allow-Origin": "*",
			},
		);
	} catch (error) {
		logApiError("creating paste", error);
		return createErrorResponse(
			"Failed to create paste",
			500,
			"INTERNAL_ERROR",
			{
				"Access-Control-Allow-Origin": "*",
			},
		);
	}
}
