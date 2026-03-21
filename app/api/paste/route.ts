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

function isValidPasteBody(body: unknown): body is {
	content: string;
	format: PasteFormat;
	language?: string;
	expirySeconds: number;
	burnAfterRead?: boolean;
} {
	if (typeof body !== "object" || body === null) {
		return false;
	}

	const b = body as Record<string, unknown>;

	// Validate content
	if (typeof b.content !== "string" || b.content.length === 0) {
		return false;
	}

	// Validate format
	const validFormats = FORMAT_OPTIONS.map((f) => f.value);
	if (!validFormats.includes(b.format as PasteFormat)) {
		return false;
	}

	// Validate expiry
	const validExpiries = EXPIRY_OPTIONS.map((e) => e.value);
	if (
		typeof b.expirySeconds !== "number" ||
		!validExpiries.includes(b.expirySeconds as (typeof validExpiries)[number])
	) {
		return false;
	}

	// Validate language if provided and format is code
	if (b.format === "code" && b.language !== undefined) {
		if (typeof b.language !== "string") {
			return false;
		}
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

		// Additional validation: content size
		if (Buffer.byteLength(body.content, "utf8") > MAX_PASTE_SIZE_BYTES) {
			return NextResponse.json(
				{ error: `Content exceeds maximum size of 5MB` },
				{ status: 400 },
			);
		}

		const input: CreatePasteInput = {
			content: body.content,
			format: body.format,
			language: body.format === "code" ? body.language : undefined,
			expirySeconds: body.expirySeconds,
			burnAfterRead: Boolean(body.burnAfterRead),
		};

		const paste = await createPaste(input);
		const baseUrl = getBaseUrl(request.url);

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
