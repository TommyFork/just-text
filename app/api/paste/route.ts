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

		if (typeof body !== "object" || body === null) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		const { content, format, language, expirySeconds, burnAfterRead } =
			body as Record<string, unknown>;

		// Validate content
		if (typeof content !== "string" || content.length === 0) {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 },
			);
		}

		if (Buffer.byteLength(content, "utf8") > MAX_PASTE_SIZE_BYTES) {
			return NextResponse.json(
				{ error: `Content exceeds maximum size of 5MB` },
				{ status: 400 },
			);
		}

		// Validate format
		const validFormats = FORMAT_OPTIONS.map((f) => f.value);
		if (!validFormats.includes(format as PasteFormat)) {
			return NextResponse.json(
				{ error: `Invalid format. Must be one of: ${validFormats.join(", ")}` },
				{ status: 400 },
			);
		}

		// Validate expiry
		const validExpiries = EXPIRY_OPTIONS.map((e) => e.value);
		if (
			typeof expirySeconds !== "number" ||
			!validExpiries.includes(expirySeconds as (typeof validExpiries)[number])
		) {
			return NextResponse.json(
				{ error: "Invalid expiry value" },
				{ status: 400 },
			);
		}

		// Validate language if format is code
		if (
			format === "code" &&
			language !== undefined &&
			typeof language !== "string"
		) {
			return NextResponse.json({ error: "Invalid language" }, { status: 400 });
		}

		const input: CreatePasteInput = {
			content,
			format: format as PasteFormat,
			language:
				format === "code" ? (language as string | undefined) : undefined,
			expirySeconds,
			burnAfterRead: Boolean(burnAfterRead),
		};

		const paste = await createPaste(input);

		const baseUrl =
			process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;

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
