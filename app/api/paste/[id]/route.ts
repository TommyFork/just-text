import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/ip";
import { getPaste } from "@/lib/paste";
import { checkReadRateLimit } from "@/lib/rate-limit";

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
			return NextResponse.json(
				{ error: "Rate limit exceeded" },
				{
					status: 429,
					headers: {
						"Retry-After": String(
							rateLimit.resetAt - Math.floor(Date.now() / 1000),
						),
					},
				},
			);
		}

		const paste = await getPaste(id);
		if (!paste) {
			return NextResponse.json(
				{ error: "Paste not found or has expired" },
				{ status: 404 },
			);
		}

		return NextResponse.json(paste, {
			headers: {
				"Cache-Control": paste.burnAfterRead
					? "private, no-store"
					: "public, max-age=60",
			},
		});
	} catch (error) {
		logApiError("reading paste", error);
		return NextResponse.json(
			{ error: "Failed to read paste" },
			{ status: 500 },
		);
	}
}
